'use strict';

require('dotenv').config()

// Setup express
const express = require("express");
const app = express();
const PORT = 8080;
const HOST = '0.0.0.0';

// Setup tonweb
const wallets = require('./wallets');

///////////////////////////////////
// Utilities
///////////////////////////////////

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

///////////////////////////////////
// Routes
///////////////////////////////////


function createChannelFromState(wallet, state) {
  state.address.hashPart = Uint8Array.from(Object.values(state.address.hashPart));
  state.keyPair.publicKey = Uint8Array.from(Object.values(state.keyPair.publicKey));
  return wallets.tonweb.payments.createChannel({
      channelId: new wallets.BN(state.channelId),
      addressA: state.address,
      addressB: wallet.wallet.address,
      initBalanceA: wallets.toNano(state.initBalanceA),
      initBalanceB: wallets.toNano(state.initBalanceB),
      isA: false,
      myKeyPair: wallet.keyPair,
      hisPublicKey: state.keyPair.publicKey
  });
}

function channelHelper(channel, wallet) {
  return channel.fromWallet({
      wallet: wallet.wallet,
      secretKey: wallet.keyPair.secretKey
  });
}


var homeRouter = require('./routes/home');
app.use(homeRouter);
app.use(express.json());

app.get('/get-server-wallet', async (req, res) => {
    let wallet;
    try {
        wallet = await wallets.getServerWallet();
    }  catch(err) {
        console.log(err);
    }
    res.send({
      addressStr: wallet.address,
      address: wallet.wallet.address,
      keyPair: {publicKey: Buffer.from(wallet.keyPair.publicKey).toString('base64')}
    });
});


app.post('/deploy-server-channel', async (req, res, next) => {

    // Get server wallet
    let wallet;
    try {
        wallet = await wallets.getServerWallet();
    }  catch(err) {
        console.log(err);
        res.status(500).send(err)
    }

    // Create channel
    const channel = createChannelFromState(wallet, req.body);
    const fromWallet = channelHelper(channel, wallet);

    // Check if channel addresses match
    let channelsMatch;
    try {
        let channelAddress = (await channel.getAddress()).toString();
        console.log('Channel Address', channelAddress, '//', req.body.channelAddress);
        channelsMatch = (channelAddress === req.body.channelAddress);
    } catch(err) {
        console.log(err);
        res.status(403).send(err)
    }

    // Deploy channel to blockchain
    console.log('Deploying channel...');
    try {
      await fromWallet.deploy().send(wallets.netFee);
    } catch(err) {
      console.log(err);
      res.status(500).send(err)
    }
    console.log('Channel deployed.');

    res.send({status: 'deployed'});

});


app.post('/init-server-channel', async (req, res, next) => {

    // Get server wallet
    let wallet;
    try {
        wallet = await wallets.getServerWallet();
    }  catch(err) {
        console.log('Caught error...')
        console.log(err);
        res.status(500).send(err)
        return;
    }

    // Create channel
    const channel = createChannelFromState(wallet, req.body);
    const fromWallet = channelHelper(channel, wallet);

    // Check if channel addresses match
    let channelsMatch;
    try {
        let channelAddress = (await channel.getAddress()).toString();
        console.log('Channel Address', channelAddress, '//', req.body.channelAddress);
        channelsMatch = (channelAddress === req.body.channelAddress);
    } catch(err) {
        console.log('Caught error...')
        console.log(err);
        res.status(500).send(err);
    }
    if (!channelsMatch) {
        res.status(403).send({
            status: 'error',
            message: 'Channel addresses do not match.'
        });
        return;
    }

    // Top up channel
    try{
        console.log('Topping up...');
        await fromWallet
            .topUp({coinsA: new wallets.BN(req.body.seqnoA), coinsB: wallets.toNano(req.body.initBalanceB)})
            .send(wallets.toNano(req.body.initBalanceB));

        // Init channel
        console.log('Initializing channel...');
        await fromWallet.init({
            balanceA: wallets.toNano(req.body.initBalanceA),
            balanceB: wallets.toNano(req.body.initBalanceA),
            seqnoA: new wallets.BN(req.body.seqnoA),
            seqnoB: new wallets.BN(req.body.seqnoB)
        }).send(wallets.netFee);
        console.log('Channel initialized.');
    } catch(err) {
        console.log('Caught error...')
        console.log(err);
        res.status(500).send(err);
    }

    res.send({status: 'initialized'});
    return;

});

app.post('/transfer-server-channel', async (req, res, next) => {

    // Get server wallet
    let wallet;
    try {
        wallet = await wallets.getServerWallet();
    }  catch(err) {
        console.log(err);
        res.status(500).send(err)
    }

    // Create channel
    const channel = createChannelFromState(wallet, req.body);
    const fromWallet = channelHelper(channel, wallet);

    // Check if channel addresses match
    let channelsMatch;
    try {
        channelsMatch = ((await channel.getAddress()).toString() === req.body.channelAddressA);
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
    }
    if (!channelsMatch) {
        res.status(403).send({
            status: 'error',
            message: 'Channel addresses do not match.'
        });
    }

    // Make off-chain transfer
    console.log('Starting offchain transfer...');
    // Verify state signature
    let isValidState;
    try {
        isValidState = (await channel.verifyState(req.body.lastState, req.body.signatureState));
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
    }
    if (!isValidState) {
      res.status(403).send({
          status: 'error',
          message: 'Invalid state signature.'
      });
    }
    // Sign state
    const signatureB1 = await channel.signState(req.body.lastState);
    console.log('Transfer done.');

    res.send({status: 'transfered'});

});


app.get('/close-server-channel', async (req, res, next) => {

    // Get server wallet
    let wallet;
    try {
        wallet = await wallets.getServerWallet();
    }  catch(err) {
        console.log(err);
        res.status(500).send(err)
    }

    // Create channel
    const channel = createChannelFromState(wallet, req.body);
    const fromWallet = channelHelper(channel, wallet);

    // Check if channel addresses match
    let channelsMatch;
    try {
        channelsMatch = ((await channel.getAddress()).toString() === req.body.channelAddressA);
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
    }
    if (!channelsMatch) {
        res.status(403).send({
            status: 'error',
            message: 'Channel addresses do not match.'
        });
    }

    console.log('Closing channel...');
    // Verify close signature
    let isValidClose;
    try {
        isValidClose = (await channel.verifyClose(req.body.lastState, req.body.signatureClose));
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
    }
    if (!isValidClose) {
      res.status(403).send({
          status: 'error',
          message: 'Invalid closing signature.'
      });
    }
    // Close channel
    await fromWallet.close({
        ...req.body.lastState,
        hisSignature: req.body.signatureClose
    }).send(wallets.netFee);
    console.log('Channel closed.');

    res.send({status: 'closed'});

});


const initTon = async () => {

    try {
        let tonweb = wallets.tonweb;
        let toNano = wallets.toNano;
        let netFee = wallets.netFee;
        let BN = wallets.BN;

        // Create wallet from scratch
        const walletA = await wallets.createWalletFromSeed('lPHZcR9JtZoIYAYX3lvx1IeNlFxZqabQ0RF4RoZMoK8=');
        wallets.logWallet(walletA, 'A');
        const walletB = await wallets.createWalletFromSeed('ZkiNN8Gowo7X0AZGU/I5Yrm2v4yUK36UADdkjQR4zKc=');
        wallets.logWallet(walletB, 'B');

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
        // const channelId = 4;
        console.log('Payment Channel ID:', channelId);
        const channelInitState = {
            balanceA: toNano('0.2'),
            balanceB: toNano('0.2'),
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
        console.log('Deploying channel...');
        await fromWalletA.deploy().send(netFee);
        console.log('Channel deployed.');

        await sleep(10000);
        await wallets.checkChannelState(channelA);

        console.log('Topping up from wallet A...');
        await fromWalletA
            .topUp({coinsA: channelInitState.balanceA, coinsB: new BN(0)})
            .send(channelInitState.balanceA);
        await sleep(10000);

        console.log('Topping up from wallet B...');
        await fromWalletB
            .topUp({coinsA: new BN(0), coinsB: channelInitState.balanceB})
            .send(channelInitState.balanceB);

        await sleep(10000);
        await wallets.checkChannelState(channelA);

        console.log('Sending init...');
        await fromWalletA.init(channelInitState).send(netFee);
        console.log('Init done.');

        await sleep(10000);
        await wallets.checkChannelState(channelA);

        console.log('Starting offchain transfer 1...');
        // Off-chain transfer
        const channelState1 = {
            balanceA: toNano('0.17'),
            balanceB: toNano('0.23'),
            seqnoA: new BN(1),
            seqnoB: new BN(0)
        };
        console.log('A is signing off-chain transfer 1...');
        const signatureA1 = await channelA.signState(channelState1);
        console.log(signatureA1);
        if (!(await channelB.verifyState(channelState1, signatureA1))) {
            throw new Error('Invalid A signature');
        }
        console.log('B is signing off-chain transfer 1...');
        const signatureB1 = await channelB.signState(channelState1);

        // Get data
        await sleep(10000);
        await wallets.checkChannelState(channelA);

        // Close channel
        console.log('Closing channel...');
        const signatureCloseB = await channelB.signClose(channelState1);
        if (!(await channelA.verifyClose(channelState1, signatureCloseB))) {
            throw new Error('Invalid B signature');
        }

        await sleep(10000);
        await wallets.checkChannelState(channelA);


        await fromWalletA.close({
            ...channelState1,
            hisSignature: signatureCloseB
        }).send(netFee);

        console.log('Closed channel...');

        await sleep(10000);
        await wallets.checkChannelState(channelA);

    } catch(err) {
        console.log('Caught exception...');
        console.log(err);
    }

}


app.listen(PORT, HOST, () => {
  // initTon();
  console.log(`Server started, running on http://${HOST}:${PORT}`);
});
