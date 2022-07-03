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
        return;
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
        let channelData = await channel.getData();
        let prevBalance = channelData.balanceB.toNumber();
        let currBalance = prevBalance;

        // Top up
        await fromWallet
            .topUp({coinsA: new wallets.BN(req.body.seqnoA), coinsB: wallets.toNano(req.body.initBalanceB)})
            .send(wallets.toNano(req.body.initBalanceB).add(wallets.netFee));

        while (currBalance === prevBalance) {
          channelData = await channel.getData();
          currBalance = channelData.balanceB.toNumber();
          await sleep(500);
        }

        // Init channel
        console.log('Initializing channel...');
        await fromWallet.init({
            balanceA: wallets.toNano(req.body.initBalanceA),
            balanceB: wallets.toNano(req.body.initBalanceB),
            seqnoA: new wallets.BN(req.body.seqnoA),
            seqnoB: new wallets.BN(req.body.seqnoB)
        }).send(wallets.netFee);
        console.log('Channel initialized.');
    } catch(err) {
        console.log('Caught error...')
        console.log(err);
        res.status(500).send(err);
        return;
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
        let channelAddress = (await channel.getAddress()).toString();
        console.log('Channel Address', channelAddress, '//', req.body.channelAddress);
        channelsMatch = (channelAddress === req.body.channelAddress);
    } catch(err) {
        console.log('Caught error...');
        console.log(err);
        res.status(500).send(err);
    }
    if (!channelsMatch) {
        console.log('channels do not match.');
        res.status(403).send({
            status: 'error',
            message: 'Channel addresses do not match.'
        });
        return;
    }

    // Make off-chain transfer
    console.log('Starting offchain transfer...');
    // Verify state signature
    let isValidState;
    const lastState = {
      balanceA: wallets.toNano(req.body.lastState.balanceA.toString()),
      balanceB: wallets.toNano(req.body.lastState.balanceB.toString()),
      seqnoA: new wallets.BN(req.body.lastState.seqnoA.toString()),
      seqnoB: new wallets.BN(req.body.lastState.seqnoB.toString())
    }
    try {
        isValidState = (await channel.verifyState(lastState, wallets.tonweb.utils.base64ToBytes(req.body.signature)));
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
        return;
    }
    if (!isValidState) {
      res.status(403).send({
          status: 'error',
          message: 'Invalid state signature.'
      });
      return;
    }
    // Sign state
    const signatureB1 = await channel.signState(lastState);
    console.log('Transfer done.');

    res.send({status: 'transfered'});
    return;

});


app.post('/close-server-channel', async (req, res, next) => {

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
        console.log('Caught error...');
        console.log(err);
        res.status(500).send(err);
    }
    if (!channelsMatch) {
        console.log('channels do not match.');
        res.status(403).send({
            status: 'error',
            message: 'Channel addresses do not match.'
        });
        return;
    }

    console.log('Veryfing close signature...');
    // Verify close signature
    let isValidClose;
    const lastState = {
      balanceA: wallets.toNano(req.body.lastState.balanceA.toString()),
      balanceB: wallets.toNano(req.body.lastState.balanceB.toString()),
      seqnoA: new wallets.BN(req.body.lastState.seqnoA.toString()),
      seqnoB: new wallets.BN(req.body.lastState.seqnoB.toString())
    }
    let hisSignature = wallets.tonweb.utils.base64ToBytes(req.body.signature);
    try {
        isValidClose = (await channel.verifyClose(lastState, hisSignature));
    } catch(err) {
        console.log(err);
        res.status(500).send(err)
        return;
    }
    if (!isValidClose) {
      res.status(403).send({
          status: 'error',
          message: 'Invalid close signature.'
      });
      return;
    }
    console.log('Close signature verified.');


    console.log('Closing channel...');
    try {
      await fromWallet.close({
          ...lastState,
          hisSignature: hisSignature
      }).send(wallets.netFee);
    } catch(err) {
        console.log('Error in closing channel');
        console.log(err);
        res.status(500).send(err)
        return;
    }

    console.log('Channel closed.');
    res.send({status: 'closed'});

});


app.listen(PORT, HOST, () => {
  console.log(`Server started, running on http://${HOST}:${PORT}`);
});
