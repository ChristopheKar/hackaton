import TonWeb from 'tonweb';
import { arrayToBase64 } from './helpers';
import { cookies } from './cookies';

const providerUrl = 'https://testnet.toncenter.com/api/v2/jsonRPC'; // TON HTTP API on TESTNET
export const tonweb = new TonWeb(new TonWeb.HttpProvider(providerUrl, {apiKey: '4d754c4e7326fac4cf685bf1e6d3c5315816a5fcaf985f69e6ceb3d78e687621'}));

export const deployTonWallet = async (wallet) => {
  try{
    await wallet?.wallet?.deploy(Uint8Array.from(Object.values(wallet?.keyPair.secretKey)))?.send();
    console.log('wallet deployed');
    const cookieWallet = cookies.get('wallet');
    cookies.set('wallet', {
      ...cookieWallet,
      isDeployed: true
    })
    return true;
  }catch(e){
    console.log('error deploying')
    console.log(e)
    return false;
  }
}

export const getOnChainBalance = async (wallet) => {
  return parseInt(await tonweb.getBalance(wallet.address));
}

export const initWalletFromKeyPair = async (keyPair, create) => {

  const WalletClass = tonweb.wallet.all['v3R1'];
  const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
      wc: 0
  });
  await wallet.getAddress();

  let deploymentSuccessful = false;
  let deployFee;
  if(create){
    let deploy = wallet.deploy(keyPair.secretKey);
    try{
      await deploy.send();
      deploymentSuccessful = true;
    }catch(e){
      try{
        deployFee = await deploy.estimateFee();
      }catch(e2){
        console.log('could not estimate deploy fee')
      }
    }
  }

  let onChainBalance;

  try{
    onChainBalance = await getOnChainBalance(wallet);
  }catch(e){
  }

  return {
    wallet,
    keyPair,
    onChainBalance,
    ...(create && {
      isDeployed: deploymentSuccessful,
      ...(!deploymentSuccessful && {deployFee: deployFee?.source_fees?.gas_fee}),
    }),
    address: wallet.address.toString(true, true, true),
    nonBounceableAddress: wallet.address.toString(true, true, false)
  }

}

export const createWalletFromSeed = async (seedBase64) => {

  let create = false;
  if (seedBase64 === undefined) {
    create = true;
    seedBase64 = arrayToBase64(tonweb.utils.newSeed()).toString('base64');
  }
  const seed = tonweb.utils.base64ToBytes(seedBase64);
  const keyPair = tonweb.utils.keyPairFromSeed(seed);

  const wallet = await initWalletFromKeyPair(keyPair, create);
  wallet.seedB64 = seedBase64;

  return wallet;

}
