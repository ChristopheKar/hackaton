import { useEffect, useState } from 'react';

import './App.css';
import { getInitialState } from './lib';
import { getOnChainBalance } from './lib/tonweb';
import SlotMachine from './components/SlotMachine';

function App() {

  const [wallet, setWallet] = useState({});
  const [channel, setChannel] = useState();

  let walletBalance = ((wallet?.onChainBalance || 0) + (channel?.balanceA || 0));


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
    })()
  }, []);


  useEffect(() => {
    if(gameResults?.won === true){
      console.log('game won')
    }else if(gameResults?.won === false){
      console.log('game lost')
    }
  }, [gameResults])


  const refreshBalanceOnClick = () => {
    getOnChainBalance(wallet)
    .then((onChainBalance) => {
      setWallet({
        ...wallet,
        onChainBalance
      })
    })
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
        <p>Your wallet address: {wallet?.address}</p>
        <div style={{display: 'flex', flexDirection: 'row'}}>
          <p>Wallet Balance: {walletBalance} nanoTON</p>
          <button onClick={refreshBalanceOnClick} style={{marginLeft: '10px'}}>Refresh</button>
        </div>
        <h3>The Dagag Machine</h3>
        {
          (walletBalance <= 0) &&
          <p>Send some TON to your Dagag Wallet on the above address to start playing !</p>
        }
        <p style={{fontSize: 14, color: '#00D'}}><b>Note: For the purposes of this MVP, your wallet is stored in a cookie, if you disable or delete cookies in your browser, you will lose your balance</b></p>
        <div style={{width: '80%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}}>
          <button disabled={walletBalance <= 0}>START GAME</button>
          <button disabled={walletBalance <= 0}>Cash Out</button>
        </div>
        <SlotMachine
          hideInteractions={walletBalance <= 0 || !channel}
          amountBet={amountBet}
          setAmountBet={setAmountBet}
          setGameResults={setGameResults}
        />
      </header>
    </div>
  );
}

export default App;
