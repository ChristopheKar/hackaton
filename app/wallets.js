// Setup tonweb
const TonWeb = require('tonweb');
const providerUrl = 'https://testnet.toncenter.com/api/v2/jsonRPC'; // TON HTTP API on TESTNET
const tonweb = new TonWeb(new TonWeb.HttpProvider(providerUrl, {apiKey: process.env.TON_TEST_API_KEY}));
const tonMnemonic = require('tonweb-mnemonic');


const BN = TonWeb.utils.BN;
const toNano = TonWeb.utils.toNano;
const netFee = toNano(process.env.NETWORK_FEE)



function logWallet(wallet, name) {
    console.log(`Wallet ${name || ''}:`, {seed: wallet.seedB64, address: wallet.address});
}

const checkChannelState = async (channel) => {
  console.log(await channel.getChannelState());
  const data = await channel.getData();
  console.log('balanceA = ', data.balanceA.toString())
  console.log('balanceB = ', data.balanceB.toString())
}


const initWalletFromKeyPair = async (keyPair, create) => {

  if (create === undefined) {
      create = true;
  }

  const WalletClass = tonweb.wallet.all['v4R2'];
  const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
      wc: 0
  });
  // const wallet = tonweb.wallet.create({publicKey: keyPair.publicKey});
  await wallet.getAddress();

  return {
    wallet: wallet,
    keyPair: keyPair,
    address: wallet.address.toString(true, true, true),
  }

}

const createWalletFromSeed = async (seedBase64) => {

  let create = false;
  if (seedBase64 === undefined) {
    create = true;
    seedBase64 = Buffer.from(tonweb.utils.newSeed()).toString('base64');
  }
  const seed = TonWeb.utils.base64ToBytes(seedBase64);
  const keyPair = tonweb.utils.keyPairFromSeed(seed);

  const wallet = await initWalletFromKeyPair(keyPair, create);
  wallet.seedB64 = seedBase64;

  return wallet;

}


const createWalletFromMnemonic = async (mnemonic) => {

  let create = false;
  if (mnemonic === undefined) {
    create = true;
    mnemonic = await tonMnemonic.generateMnemonic();
  }

  const isValid = await tonMnemonic.validateMnemonic(mnemonic);
  if (!isValid) {
    throw new Error('Mnemonic is invalid.');
  }

  const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic);
  const wallet = await initWalletFromKeyPair(keyPair, create);
  wallet.mnemonic = mnemonic;

  return wallet;
}


let serverWallet;

const getServerWallet = async () => {
  if (serverWallet) {
      return Promise.resolve(serverWallet);
  } else {
      serverWallet = await createWalletFromSeed('lPHZcR9JtZoIYAYX3lvx1IeNlFxZqabQ0RF4RoZMoK8=');
      return Promise.resolve(serverWallet);
  }
}


module.exports = {
  tonweb,
  BN,
  toNano,
  netFee,
  logWallet,
  checkChannelState,
  createWalletFromSeed,
  getServerWallet
}
