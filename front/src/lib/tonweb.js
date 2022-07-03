const TonWeb = require('tonweb');
const providerUrl = 'https://testnet.toncenter.com/api/v2/jsonRPC'; // TON HTTP API on TESTNET
const tonweb = new TonWeb(new TonWeb.HttpProvider(providerUrl, {apiKey: '4d754c4e7326fac4cf685bf1e6d3c5315816a5fcaf985f69e6ceb3d78e687621'}));

function arrayToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa(binary);
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

  if(create){
    await wallet.deploy(keyPair.secretKey).send();
  }

  let onChainBalance = await getOnChainBalance(wallet);

  return {
    wallet,
    keyPair,
    onChainBalance,
    address: wallet.address.toString(true, true, true),
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
