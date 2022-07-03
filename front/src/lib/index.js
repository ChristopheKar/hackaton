import { initWalletFromKeyPair, createWalletFromSeed } from './tonweb';
import { cookies } from './cookies';
import { tonweb } from './tonweb';

export const getInitialState = async () => {

  let cookieWallet = cookies.get('wallet');

  if(cookieWallet && cookieWallet?.keyPair?.publicKey){

    let wallet = await initWalletFromKeyPair(cookieWallet?.keyPair);

    let channelCookie = cookies.get('channel');
    let channel = {
      ...channelCookie,
      seqNoA: parseInt(channelCookie?.seqNoA),
      seqNoB: parseInt(channelCookie?.seqNoB),
      balanceA: parseInt(channelCookie?.balanceA),
      balanceB: parseInt(channelCookie?.balanceB)
    }

    if(channelCookie?.closed === false){
      channel = tonweb.payments.createChannel({
          channelId: new tonweb.utils.BN(channelCookie?.channelId),
          addressA: wallet?.wallet?.address,
          addressB: channelCookie?.address,
          initBalanceA: tonweb.utils.toNano(channelCookie?.balanceA),
          initBalanceB: tonweb.utils.toNano(channelCookie?.balanceB),
          isA: true,
          myKeyPair: wallet?.keyPair,
          hisPublicKey: channelCookie?.serverWallet.keyPair.publicKey
      });
      await channel.getAddress();    // this also fills channel object's address
    }

    return Promise.resolve({
      wallet: {
        ...cookieWallet,
        ...wallet
      },
      ...(channelCookie && {
        ...channel
      })
    });

  }else{

    // Just in case someone removed his wallet cookie and kept this cookie, to prevent inconsistencies
    cookies.remove('channel');

    let wallet = await createWalletFromSeed();

    cookies.set('wallet', {
      keyPair: wallet?.keyPair,
      address: wallet?.address,
      isDeployed: wallet?.isDeployed,
      deployFee: wallet?.deployFee,
      nonBounceableAddress: wallet?.nonBounceableAddress
    })

    return Promise.resolve({
      wallet
    });

  }

}
