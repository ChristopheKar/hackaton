import { useEffect, useState } from 'react';

import './App.css';
import { getInitialState } from './lib';
import { getOnChainBalance, deployTonWallet } from './lib/tonweb';
import { deployAndInitServerChannel, makeTransfer, closeChannel } from './lib/channel-interaction';
import SlotMachine from './components/SlotMachine';

function App() {

  const [wallet, setWallet] = useState();
  const [channel, setChannel] = useState();
  const [channelInfo, setChannelInfo] = useState();

  const [initializingChannel, setInitializingChannel] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  // let walletBalance = ((wallet?.onChainBalance || 0) + (channel?.balanceA || 0));

  const [deploymentError, setDeploymentError] = useState();

  const [gameResults, setGameResults] = useState(null);
  const [amountBet, setAmountBet] = useState(0);

  /*
    {
      wallet: {
        keyPair: {
          secretKey,          // generate onLoad or retrieve from cookie
          publicKey,           // generate onLoad or retrieve from cookie
        },
        address,             // generate onLoad or retrieve from cookie
        onChainBalance       // get from explorer onPlay
      },
      channel: {
        id,                   // retrieve from cookie or generate onPlay
        initialBalanceA,      // retrieve from cookie or max(wallet.balance, 20) 20 being the max possible pool
        initialBalanceB,      // retrieve from cookie or calculate onPlay from initialBalanceA
        seqNoA,               // retrieve from cookie or 0 onPlay
        seqNoB,               // retrieve from cookie or 0 onPlay
        balanceA,             // retrieve from cookie or initialBalanceA onPlay
        balanceB              // retrieve from cookie or initialBalanceA onPlay
      }
    }
  */

  useEffect(() => {
    (async () => {
      const initialState = await getInitialState();
      setWallet(initialState?.wallet);
      setChannel(initialState?.channel);
      setChannelInfo(initialState?.channelCookie)
    })()
  }, []);


  useEffect(() => {
    if(gameResults !== null){
      (async () => {
        try{
          const updatedChannel = (await makeTransfer(wallet, channel, amountBet, gameResults?.won));
          setChannelInfo(updatedChannel);
        }catch(e){
          console.log('error')
        }
      })()
    }
  }, [gameResults])


  const refreshOnChainBalance = async () => {
    return getOnChainBalance(wallet)
    .then((onChainBalance) => {
      setWallet({
        ...wallet,
        onChainBalance
      })
      return;
    })
  }

  const cashOut = async () => {
    try{
      setCashingOut(true);
      const updatedChannel = (await closeChannel(wallet, channel));
      await refreshOnChainBalance();
      setChannelInfo(updatedChannel);
    }catch(e){
      console.log('error')
    }finally{
      setCashingOut(false);
    }
  }

  const deployWallet = async () => {
    setDeploymentError(null);
    let deployed = wallet?.isDeployed;
    try{
      if(!deployed){
        deployed = await deployTonWallet(wallet);
      }
    }catch(e){
    }finally{
      await refreshOnChainBalance();
      if(deployed){
        setWallet({
          ...wallet,
          isDeployed: true
        });
      }else{
        setDeploymentError('Could not deploy wallet, your balance is ' + wallet?.onChainBalance + ' nanoTONs');
      }
    }
  }

  const startGame = async () => {
    setInitializingChannel(true);
    await refreshOnChainBalance();
    const {channel: tempChannel, cookieChannelConfig: tempChannelInfo} = await deployAndInitServerChannel(wallet, channel);
    setChannel(tempChannel);
    setChannelInfo(tempChannelInfo);
    setInitializingChannel(false);
  }

  return (
    <div className="App">
      <header className="App-header">
        {/* <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a> */}
        <h3>The Dagag Machine</h3>
        {
          (
            initializingChannel ?
            (
              <p>We are initializing an off-chain channel between you and our server, please wait as this may take up to one minute</p>
            ) :
            (
              (
                wallet &&
                wallet?.isDeployed
              ) ?
              <>
                <p>Your wallet address: {wallet?.address}</p>
                <div style={{display: 'flex', flexDirection: 'row'}}>
                  <p>Wallet Balance: {wallet?.onChainBalance} nanoTONs</p>
                  <button onClick={refreshOnChainBalance} style={{marginLeft: '10px'}}>Refresh</button>
                </div>
                {
                  (wallet?.onChainBalance <= 0) ?
                  <p>Send some TON to your Dagag Wallet on the above address to start playing !</p> :
                  <p>Your balance in the game channel: {Math.round((channelInfo?.balanceA || 0) * 1000000000)} nanoTONs</p>
                }
                <p style={{fontSize: 14, color: '#00D'}}><b>Note: For the purposes of this MVP, your wallet is stored in a cookie, if you disable or delete cookies in your browser, you will lose your balance</b></p>
                <div style={{width: '80%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}}>
                  {
                    (
                      !channel ||
                      channel?.closed
                    ) &&
                    wallet &&
                    <button
                      onClick={startGame}
                      disabled={wallet?.onChainBalance <= 0}
                    >
                      START GAME
                    </button>
                  }
                  <button onClick={cashOut} disabled={channelInfo?.balanceA <= 0 || cashingOut}>Cash Out</button>
                </div>
              </> :
              (
                wallet &&
                <>
                  <p>
                    Welcome to the Dagag Machine ! We generated a wallet for you, send {wallet?.deployFee} nanoTONs to the following address to deploy it and get started.
                  </p>
                  <p>
                    Non-Bounceable Address: {wallet?.nonBounceableAddress}
                  </p>
                  {
                    deploymentError &&
                    <p style={{fontSize: 12, color: "#D00"}}>{deploymentError}</p>
                  }
                  <button onClick={deployWallet} style={{marginLeft: '10px'}}>Deploy</button>
                </>
              )
            )
          )
        }
        <SlotMachine
          hideInteractions={channelInfo?.balanceA <= 0 || !channel || channel?.closed}
          canPlay={amountBet > 0 && amountBet <= (channelInfo?.balanceA * 1000000000)}
          amountBet={amountBet}
          setAmountBet={setAmountBet}
          setGameResults={setGameResults}
        />
      </header>
    </div>
  );
}

export default App;
