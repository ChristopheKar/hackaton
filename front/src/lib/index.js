import { initWalletFromKeyPair, createWalletFromSeed } from './tonweb';
import { tonweb } from './tonweb';
import { cookies } from './cookies';


export const getInitialState = async () => {

  let cookieWallet = cookies.get('wallet');

  if(cookieWallet && cookieWallet?.keyPair?.publicKey){

    let wallet = await initWalletFromKeyPair({
      publicKey: Uint8Array.from(Object.values(cookieWallet?.keyPair?.publicKey)),
      secretKey: Uint8Array.from(Object.values(cookieWallet?.keyPair?.secretKey))
    });

    let channelCookie = cookies.get('channel');
    // let channel = {
    //   ...channelCookie,
    //   seqNoA: parseInt(channelCookie?.seqNoA),
    //   seqNoB: parseInt(channelCookie?.seqNoB),
    //   balanceA: tonweb.utils.toNano(channelCookie?.balanceA),
    //   balanceB: tonweb.utils.toNano(channelCookie?.balanceB)
    // }
    let channel;
    if(channelCookie?.closed === false){
      channel = tonweb.payments.createChannel({
          channelId: new tonweb.utils.BN(channelCookie?.channelId),
          addressA: wallet?.wallet?.address,
          addressB: channelCookie?.address,
          initBalanceA: tonweb.utils.toNano(channelCookie?.initBalanceA),
          initBalanceB: tonweb.utils.toNano(channelCookie?.initBalanceB),
          isA: true,
          myKeyPair: {
            publicKey: Uint8Array.from(Object.values(wallet?.keyPair?.publicKey)),
            secretKey: Uint8Array.from(Object.values(wallet?.keyPair?.secretKey))
          },
          hisPublicKey: Uint8Array.from(Object.values(channelCookie?.serverWallet.keyPair.publicKey))
      });
      await channel.getAddress();    // this also fills channel object's address
    }

    return Promise.resolve({
      wallet: {
        ...cookieWallet,
        ...wallet
      },
      ...(channel && {channel}),
      ...(channelCookie && {channelCookie})
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
