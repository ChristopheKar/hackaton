import axios from 'axios';
import { tonweb } from './tonweb';
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

    let commonChannelState = {
      channelId: existingChannel?.channelId || 99,
      balanceA: existingChannel?.balanceA || (clientWallet.onChainBalance / 1000000000).toString(),
      balanceB: existingChannel?.balanceB || (clientWallet.onChainBalance * 5 / 1000000000).toString(),
      seqnoA: existingChannel?.seqnoA || 0,
      seqnoB: existingChannel?.seqnoB || 0
    }

    let cookieChannelState = {
      ...commonChannelState,
      closed: false,
      serverWallet
    }

    let channelState = {
      ...commonChannelState,
      initBalanceA: commonChannelState?.balanceA,
      initBalanceB: commonChannelState?.balanceB,
      address: clientWallet?.wallet?.address,
      keyPair: {
        publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey))
      }
    }

    console.log('client wallet')
    console.log(clientWallet)
    console.log('server wallet')
    console.log(serverWallet)


    const channel = tonweb.payments.createChannel({
        channelId: new tonweb.utils.BN(channelState.channelId),
        addressA: clientWallet?.wallet?.address,
        addressB: serverWallet.address,
        initBalanceA: tonweb.utils.toNano(channelState.balanceA),
        initBalanceB: tonweb.utils.toNano(channelState.balanceB),
        isA: true,
        myKeyPair: {
          publicKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.publicKey)),
          secretKey: Uint8Array.from(Object.values(clientWallet?.keyPair?.secretKey)),
        },
        hisPublicKey: serverWallet?.keyPair?.publicKey
    });
    console.log(channel)
    const channelAddress = await channel.getAddress();    // this also fills channel object's address
    console.log('channelAddress')
    channelState.channelAddress = channelAddress.toString();

    console.log(channel);

    let deployed = false;
    let initted = false;

    try{
      const channelState = await channel.getChannelState();
      if(channelState === 1){
        deployed = true;
        initted = true;
      }else if(channelState === 0){
        deployed = true;
      }
    }catch(e){
      console.log(e)
      console.log('channel is neither deployed or initted')
    }

    console.log('moving on')

    if(!deployed){

      const {data: deployResData} = await axios.request({
        url: '/deploy-server-channel',
        method: 'post',
        baseURL: apiUrl,
        data: channelState
      })

      const fromClientWallet = channel.fromWallet({
          wallet: clientWallet.wallet,
          secretKey: clientWallet.keyPair.secretKey
      });

      fromClientWallet
        .topUp({
          coinsA: tonweb.utils.toNano(channelState.balanceA),
          coinsB: new tonweb.utils.BN(channelState.seqnoB)
        })
        .send(tonweb.utils.toNano(channelState.balanceA));

    }

    if(!initted){
      await axios.request({
        url: '/init-server-channel',
        method: 'post',
        baseURL: apiUrl,
        data: channelState
      })
      cookies.set('channel', cookieChannelState);
    }

    return Promise.resolve(channel);


  }catch(err){
    console.log('Error somewhere in channel deployment and init');
    console.log(err)
    return Promise.resolve(null);
  }

}
