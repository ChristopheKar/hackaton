import { initWalletFromKeyPair, createWalletFromSeed } from './tonweb';
import { cookies } from './cookies';


export const getInitialState = async () => {

  let cookieWallet = cookies.get('wallet');

  if(cookieWallet && cookieWallet?.keyPair?.publicKey){

    let wallet = await initWalletFromKeyPair(cookieWallet?.keyPair);

    let channel = cookies.get('channel');

    return Promise.resolve({
      wallet,
      ...(channel && {
        channel: {
          ...channel,
          initialBalanceA: parseInt(channel?.initialBalanceA),
          initialBalanceB: parseInt(channel?.initialBalanceB),
          seqNoA: parseInt(channel?.seqNoA),
          seqNoB: parseInt(channel?.seqNoB),
          balanceA: parseInt(channel?.balanceA),
          balanceB: parseInt(channel?.balanceB)
        }
      })
    });

  }else{

    // Just in case someone removed his wallet cookie and kept this cookie, to prevent inconsistencies
    cookies.remove('channel');

    let wallet = await createWalletFromSeed();

    cookies.set('wallet', {
      keyPair: wallet?.keyPair,
      address: wallet?.address
    })

    return Promise.resolve({
      wallet
    });

  }

}
