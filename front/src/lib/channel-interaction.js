import axios from 'axios';
import { tonweb } from './tonweb';
import { cookies } from './cookies';
import { sleep } from './helpers';

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
      channelId: existingChannel?.channelId || 99,
      balanceA: existingChannel?.balanceA || (Math.max(clientWallet.onChainBalance, 1000000000) / 1000000000).toString(),
      balanceB: existingChannel?.balanceB || (Math.max(clientWallet.onChainBalance, 1000000000) * 3 / 1000000000).toString(),
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
      initBalanceA: commonChannelConfig?.balanceA,
      initBalanceB: commonChannelConfig?.balanceB,
      address: clientWallet?.wallet?.address,
      keyPair: {
        publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey))
      }
    }


    const channel = tonweb.payments.createChannel({
        channelId: new tonweb.utils.BN(channelConfig.channelId),
        addressA: clientWallet?.wallet?.address,
        addressB: serverWallet.address,
        initBalanceA: tonweb.utils.toNano(channelConfig.balanceA),
        initBalanceB: tonweb.utils.toNano(channelConfig.balanceB),
        isA: true,
        myKeyPair: {
          publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey)),
          secretKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.secretKey)),
        },
        hisPublicKey: serverWallet?.keyPair?.publicKey
    });
    const channelAddress = await channel.getAddress();    // this also fills channel object's address
    channelConfig.channelAddress = channelAddress.toString();

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

      const fromClientWallet = channel.fromWallet({
          wallet: clientWallet.wallet,
          secretKey: clientWallet.keyPair.secretKey
      });

      let deploymentComplete = false;
      while(!deploymentComplete){
        try{
          const st = await channel.getChannelState();
          console.log(st);
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

      fromClientWallet
        .topUp({
          coinsA: tonweb.utils.toNano(channelConfig.balanceA),
          coinsB: new tonweb.utils.BN(channelConfig.seqnoB)
        })
        .send(tonweb.utils.toNano(channelConfig.balanceA));

      while (currBalance === prevBalance) {
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
