import axios from 'axios';
import { tonweb } from './tonweb';
import { sleep, arrayToBase64 } from './helpers';
import { cookies } from './cookies';



const apiUrl = 'http://localhost:8080';

export const getServerWallet = () => {

  return axios.get('/get-server-wallet', {
    baseURL: apiUrl
  })
  .then((res) => {
    return {
      ...res?.data,
      address: {
        ...res?.data?.address,
        hashPart: Uint8Array.from(Object.values(res?.data?.address?.hashPart))
      },
      keyPair: {
        ...res?.data?.keyPair,
        publicKey: tonweb.utils.base64ToBytes(res?.data?.keyPair?.publicKey)
      }
    }
  })
  .catch((err) => {
    throw err;
  })

}



export const deployAndInitServerChannel = async (clientWallet, existingChannel) => {

  try{

    const serverWallet = await getServerWallet();

    let commonChannelConfig = {
      channelId: existingChannel?.channelId || 80,
      initBalanceA: existingChannel?.initBalanceA || (Math.min(clientWallet.onChainBalance - 50000000, 1000000) / 1000000000).toString(),
      initBalanceB: existingChannel?.initBalanceB || (Math.min(clientWallet.onChainBalance, 1000000) * 3 / 1000000000).toString(),
      balanceA: existingChannel?.balanceA || (Math.min(clientWallet.onChainBalance - 50000000, 1000000) / 1000000000).toString(),
      balanceB: existingChannel?.balanceB || (Math.min(clientWallet.onChainBalance, 1000000) * 3 / 1000000000).toString(),
      seqnoA: existingChannel?.seqnoA || 0,
      seqnoB: existingChannel?.seqnoB || 0
    }

    let cookieChannelConfig = {
      ...commonChannelConfig,
      closed: false,
      serverWallet
    }

    let channelConfig = {
      ...commonChannelConfig,
      address: clientWallet?.wallet?.address,
      keyPair: {
        publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey))
      }
    }


    const channel = tonweb.payments.createChannel({
        channelId: new tonweb.utils.BN(channelConfig.channelId),
        addressA: clientWallet?.wallet?.address,
        addressB: serverWallet.address,
        initBalanceA: tonweb.utils.toNano(channelConfig.initBalanceA),
        initBalanceB: tonweb.utils.toNano(channelConfig.initBalanceB),
        isA: true,
        myKeyPair: {
          publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey)),
          secretKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.secretKey)),
        },
        hisPublicKey: serverWallet?.keyPair?.publicKey
    });
    const channelAddress = await channel.getAddress();    // this also fills channel object's address
    channelConfig.channelAddress = channelAddress.toString();
    cookieChannelConfig.channelAddress = channelAddress.toString();

    let deployed = false;
    let initted = false;

    try{
      const stateValue = await channel.getChannelState();
      if(stateValue === 1){
        deployed = true;
        initted = true;
      }else if(stateValue === 0){
        deployed = true;
      }
    }catch(e){
      console.log(e)
      console.log('channel is neither deployed or initted')
    }

    if(!deployed){

      const {data: deployResData} = await axios.request({
        url: '/deploy-server-channel',
        method: 'post',
        baseURL: apiUrl,
        data: channelConfig
      })

      let deploymentComplete = false;
      while(!deploymentComplete){
        try{
          const st = await channel.getChannelState();
          console.log('state is')
          console.log(st)
          deploymentComplete = true;
          break;
        }catch(e){
          // if error: channel not yet deployed
          console.log('waiting')
          await sleep(500);
        }
      }


      let channelData = await channel.getData();
      let prevBalance = channelData.balanceA.toNumber();
      let currBalance = prevBalance;

      const fromClientWallet = channel.fromWallet({
          wallet: clientWallet.wallet,
          secretKey: Uint8Array.from(Object.values(clientWallet.keyPair.secretKey))
      });

      await fromClientWallet
        .topUp({
          coinsA: tonweb.utils.toNano(channelConfig.balanceA),
          coinsB: new tonweb.utils.BN(channelConfig.seqnoB)
        })
        .send(tonweb.utils.toNano(channelConfig.balanceA).add(tonweb.utils.toNano('0.05')));

      while (currBalance === prevBalance) {
        console.log('inside the loop')
        channelData = await channel.getData();
        currBalance = channelData.balanceA.toNumber();
        await sleep(500);
      }

    }

    if(!initted){
      await axios.request({
        url: '/init-server-channel',
        method: 'post',
        baseURL: apiUrl,
        data: channelConfig
      })
      cookies.set('channel', cookieChannelConfig);
    }

    return Promise.resolve(channel);


  }catch(err){
    console.log('Error somewhere in channel deployment and init');
    console.log(err)
    return Promise.resolve(null);
  }

}


export const makeTransfer = async (clientWallet, channel, amountBet, didWin) => {

  try{

    console.log('hello')

    const channelInfo = cookies?.get('channel');
    console.log(channelInfo)

    const newSeqnoA = channelInfo?.seqnoA + (didWin ? 0 : 1);
    const newSeqnoB = channelInfo?.seqnoB + (didWin ? 0 : 1);
    const newBalanceA = ((tonweb.utils.toNano(channelInfo?.balanceA) + ((didWin ? 1 : -1) * amountBet)).toString());
    const newBalanceB = ((tonweb.utils.toNano(channelInfo?.balanceB) + ((didWin ? -1 : 1) * amountBet)).toString());

    const transactionState = {
        balanceA: newBalanceA,
        balanceB: newBalanceB,
        seqnoA: new tonweb.utils.BN(newSeqnoA),
        seqnoB: new tonweb.utils.BN(newSeqnoB)
    };

    // console.log({
    // data: {
    //   channelAddress: channelInfo?.channelAddress,
    //   address: clientWallet?.wallet?.address,
    //   keyPair: {publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey))},
    //   channelId: channelInfo?.channelId,
    //   initBalanceA: channelInfo?.initBalanceA,
    //   initBalanceB: channelInfo?.initBalanceB,
    //   lastState: {
    //     balanceA: channelInfo?.balanceA,
    //     balanceB: channelInfo?.balanceB,
    //     seqnoA: channelInfo?.seqnoA,
    //     seqnoB: channelInfo?.seqnoB
    //   },
    //   signature: arrayToBase64(signature)
    // }})

    const signature = await channel.signState(transactionState)

    // const channelAddress = await channel.getAddress();

    const res = await axios.request({
      url: '/transfer-server-channel',
      method: 'post',
      baseURL: apiUrl,
      data: {
        channelAddress: channelInfo?.channelAddress,
        address: clientWallet?.wallet?.address,
        keyPair: {publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey))},
        channelId: channelInfo?.channelId,
        initBalanceA: channelInfo?.initBalanceA,
        initBalanceB: channelInfo?.initBalanceB,
        lastState: {
          balanceA: channelInfo?.balanceA,
          balanceB: channelInfo?.balanceB,
          seqnoA: channelInfo?.seqnoA,
          seqnoB: channelInfo?.seqnoB
        },
        signature: arrayToBase64(signature)
      }
    });

    console.log('res')
    console.log(res)

    cookies.set('channel', {
      ...channelInfo,
      balanceA: (transactionState?.balanceA/1000000000)?.toString(),
      balanceB: (transactionState?.balanceB/1000000000)?.toString(),
      seqnoA: newSeqnoA,
      seqNoB: newSeqnoB
    })

    return Promise.resolve({
      ...channelInfo,
      balanceA: (transactionState?.balanceA/1000000000)?.toString(),
      balanceB: (transactionState?.balanceB/1000000000)?.toString(),
      seqnoA: newSeqnoA,
      seqNoB: newSeqnoB
    });

  }catch(err){
    console.log("Error making an off-chain transfer")
    console.log(err)
    return Promise.reject('error');
  }

}
