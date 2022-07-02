'use strict';

require('dotenv').config()

const TonWeb = require('tonweb');
const nacl = TonWeb.utils.nacl;

const providerUrl = 'https://testnet.toncenter.com/api/v2/jsonRPC'; // TON HTTP API on TESTNET
const tonweb = new TonWeb(new TonWeb.HttpProvider(providerUrl, {apiKey: process.env.TON_TEST_API_KEY}));
console.log(tonweb.provider);

const tonMnemonic = require('tonweb-mnemonic');
const crypto = require('crypto');

const express = require("express");
const app = express();
const PORT = 8080;
const HOST = '0.0.0.0';


///////////////////////////////////
// Routes
///////////////////////////////////

var homeRouter = require('./routes/home');
app.use(homeRouter);


///////////////////////////////////
// Utilities
///////////////////////////////////

const BN = TonWeb.utils.BN;
const toNano = TonWeb.utils.toNano;
const netFee = toNano(process.env.NETWORK_FEE)

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function toHexString(byteArray) {
    return Array.prototype.map.call(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

function mnemonicStringToList(mnemonic) {
    return mnemonic.split(',');
}

function sleep(ms) {
  console.log(`Waiting for ${ms}ms`);
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logWallet(wallet, name) {
    console.log(`Wallet ${name || ''}:`, {seed: wallet.seedB64, address: wallet.address});
}

///////////////////////////////////
// Wallet Creation
///////////////////////////////////

const initWalletFromKeyPair = async (keyPair, create) => {

  if (create === undefined) {
      create = true;
  }

  // const wallet = tonweb.wallet.create({
  //     publicKey: keyPair.publicKey
  // });
  const WalletClass = tonweb.wallet.all['v4R2'];
  const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
      wc: 0
  });
  await wallet.getAddress();

  return {
    wallet: wallet,
    keyPair: keyPair,
    address: wallet.address.toString(true, true, !create),
  }

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

const initTon = async () => {

    try {
        // Create wallet from scratch
        const walletA = await createWalletFromSeed('lPHZcR9JtZoIYAYX3lvx1IeNlFxZqabQ0RF4RoZMoK8=');
        logWallet(walletA, 'A');
        const walletB = await createWalletFromSeed('ZkiNN8Gowo7X0AZGU/I5Yrm2v4yUK36UADdkjQR4zKc=');
        logWallet(walletB, 'B');

        // // Deploy wallets
        // await walletA.wallet.deploy(walletA.keyPair.secretKey).send(netFee);
        // await walletB.wallet.deploy(walletB.keyPair.secretKey).send(netFee);

        // Log wallet balances
        const balanceA = await tonweb.getBalance(walletA.address);
        console.log(`Wallet A Balance: ${balanceA}`);
        const balanceB = await tonweb.getBalance(walletB.address);
        console.log(`Wallet B Balance: ${balanceB}`);


        // Create payment channel configurations
        const channelId = getRandomInt(100000);
        // const channelId = 41749;
        console.log('Payment Channel ID:', channelId);
        const channelInitState = {
            balanceA: toNano('0.1'),
            balanceB: toNano('0.1'),
            seqnoA: new BN(0), // initially 0
            seqnoB: new BN(0)  // initially 0
        };
        const channelConfig = {
            channelId: new BN(channelId),
            addressA: walletA.wallet.address,
            addressB: walletB.wallet.address,
            initBalanceA: channelInitState.balanceA,
            initBalanceB: channelInitState.balanceB
        }

        // Create payment channel at A
        const channelA = tonweb.payments.createChannel({
            ...channelConfig,
            isA: true,
            myKeyPair: walletA.keyPair,
            hisPublicKey: walletB.keyPair.publicKey,
        });
        const channelAddress = await channelA.getAddress();
        console.log('Payment Channel Address = ', channelAddress.toString(true, true, true));

        // Create payment channel at B
        const channelB = tonweb.payments.createChannel({
            ...channelConfig,
            isA: false,
            myKeyPair: walletB.keyPair,
            hisPublicKey: walletA.keyPair.publicKey,
        });

        // Check if payment channel addresses match
        if ((await channelB.getAddress()).toString() !== channelAddress.toString()) {
            throw new Error('Channels address not same');
        } else {
            console.log('A and B channels agree!');
        }

        // Create helpers to send messages from wallet to payment channel
        const fromWalletA = channelA.fromWallet({
            wallet: walletA.wallet,
            secretKey: walletA.keyPair.secretKey
        });
        const fromWalletB = channelB.fromWallet({
            wallet: walletB.wallet,
            secretKey: walletB.keyPair.secretKey
        });

        // Deploy channel to blockchain
        console.log('Deploying channel...')
        await fromWalletA.deploy().send(netFee);

        await sleep(15000);
        let data = await channelA.getData();
        console.log('balanceA = ', data.balanceA.toString())
        console.log('balanceB = ', data.balanceB.toString())

        await fromWalletA
            .topUp({coinsA: channelInitState.balanceA, coinsB: new BN(0)})
            .send(channelInitState.balanceA.add(netFee));
        await fromWalletB
            .topUp({coinsA: new BN(0), coinsB: channelInitState.balanceB})
            .send(channelInitState.balanceB.add(netFee));

        await fromWalletA.init(channelInitState).send(toNano('0.05'));

        await sleep(10000);
        data = await channelA.getData();
        console.log('balanceA = ', data.balanceA.toString())
        console.log('balanceB = ', data.balanceB.toString())

        // Off-chain transfer
        const channelState1 = {
            balanceA: toNano('0.15'),
            balanceB: toNano('0.05'),
            seqnoA: new BN(1),
            seqnoB: new BN(0)
        };
        const signatureA1 = await channelA.signState(channelState1);
        if (!(await channelB.verifyState(channelState1, signatureA1))) {
            throw new Error('Invalid A signature');
        }
        const signatureB1 = await channelB.signState(channelState1);

        // Get data
        await sleep(8000);
        data = await channelA.getData();
        console.log('balanceA = ', data.balanceA.toString())
        console.log('balanceB = ', data.balanceB.toString())

        //
        const signatureCloseB = await channelB.signClose(channelState1);
        if (!(await channelA.verifyClose(channelState1, signatureCloseB))) {
            throw new Error('Invalid B signature');
        }

        await fromWalletA.close({
            ...channelState1,
            hisSignature: signatureCloseB
        }).send(toNano('0.05'));

        console.log('Closed channel...');

    } catch(err) {
        console.log('Caught exception...');
        console.log(err);
    }

}

app.listen(PORT, HOST, () => {
  initTon();
  console.log(`Server started, running on http://${HOST}:${PORT}`);
});
