import React from 'react';
import './SlotMachine.css';

function RepeatButton(props) {
  return (
    <button
      aria-label='Play again.'
      id={props?.canPlay ? 'repeatButton' : 'disabledRepeatButton'}
      onClick={props.onClick}>
    </button>
  );
}

function WinningSound() {
  return (
  <audio autoplay="autoplay" className="player" preload="false">
    <source src="https://andyhoffman.codes/random-assets/img/slots/winning_slot.wav" />
  </audio>
  );
}



class Spinner extends React.Component {
  constructor(props){
    super(props);
    this.forceUpdateHandler = this.forceUpdateHandler.bind(this);
  };

  forceUpdateHandler(){
    this.reset();
  };

  reset() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.start = this.setStartPosition();

    this.setState({
      position: this.start,
      timeRemaining: this.props.timer
    });

    this.timer = setInterval(() => {
      this.tick()
    }, 100);
  }

  state = {
    position: 0,
    lastPosition: null
  }
  static iconHeight = 188;
  multiplier = 1//Math.floor(Math.random()*(4-1)+1);

  start = this.setStartPosition();
  speed = Spinner.iconHeight * this.multiplier;

  setStartPosition() {
    return ((Math.floor((Math.random()*9))) * Spinner.iconHeight)*-1;
  }

  moveBackground() {
    this.setState({
      position: this.state.position - this.speed,
      timeRemaining: this.state.timeRemaining - 100
    })
  }

  getSymbolFromPosition() {
    let { position } = this.state;
    const totalSymbols = 9;
    const maxPosition = (Spinner.iconHeight * (totalSymbols-1)*-1);
    let moved = (this.props.timer/100) * this.multiplier
    let startPosition = this.start;
    let currentPosition = startPosition;

    for (let i = 0; i < moved; i++) {
      currentPosition -= Spinner.iconHeight;

      if (currentPosition < maxPosition) {
        currentPosition = 0;
      }
    }

    this.props.onFinish(currentPosition);
  }

  tick() {
    if (this.state.timeRemaining <= 0) {
      clearInterval(this.timer);
      this.getSymbolFromPosition();

    } else {
      this.moveBackground();
    }
  }

  componentDidMount() {
    clearInterval(this.timer);

    this.setState({
      position: this.start,
      timeRemaining: this.props.timer
    });

    // this.timer = setInterval(() => {
    //   this.tick()
    // }, 100);
  }

  render() {
    let { position, current } = this.state;

    return (
      <div
        style={{backgroundPosition: '0px ' + position + 'px'}}
        className={`icons`}
      />
    )
  }
}

export default class SlotMachine extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // winner: null
    }
    this.finishHandler = this.finishHandler.bind(this)
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if(this?.props?.canPlay){
      this.setState({ winner: null, error: null });
      this.emptyArray();
      this._child1.forceUpdateHandler();
      this._child2.forceUpdateHandler();
      this._child3.forceUpdateHandler();
    }else{
      this.setState({ error: "Amount must be non-zero and smaller than your current balance to play"});
    }
  }

  static matches = [];

  finishHandler(value) {
    SlotMachine.matches.push(value);

    if (SlotMachine.matches.length === 3) {
      const { winner } = this.state;
      const first = SlotMachine.matches[0];
      let results = SlotMachine.matches.every(match => match === first);
      this?.props?.setGameResults({won: results});
      this.setState({ winner: results });
      // this?.props?.setAmountBet(0);
    }
  }

  emptyArray() {
    SlotMachine.matches = [];
  }

  render() {
    const { winner } = this.state;
    let repeatButton = null;
    let winningSound = null;

    if (winner !== null) {
      repeatButton =
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <p style={{fontSize: 12, color: "#D00"}}>{this?.state?.error}</p>
          <input type="number" value={this?.props?.amountBet} onChange={(e) => this?.props?.setAmountBet(e.target.value)} />
          <p />
          <RepeatButton canPlay={this?.props?.canPlay} onClick={this.handleClick} />
        </div>
    }

    if (winner) {
      winningSound = <WinningSound />
    }

    return (
      <div className='slot-machine-container'>
        {
          !this?.props?.hideInteractions &&
          <>
            {winningSound}
            {repeatButton}
          </>
        }
        <div className={`spinner-container`}>
          <Spinner onFinish={this.finishHandler} ref={(child) => { this._child1 = child; }} timer="1000" />
          <Spinner onFinish={this.finishHandler} ref={(child) => { this._child2 = child; }} timer="1400" />
          <Spinner onFinish={this.finishHandler} ref={(child) => { this._child3 = child; }} timer="2200" />
          {/* <div className="gradient-fade"></div> */}
        </div>
      </div>
    );
  }
}
