import React, { Component } from 'react';
import { connect } from 'react-redux';

import { actionCreators as headerViewActionCreators } from '../../../shell/components/header';

import * as status from '../../constants';
import {
  logout
} from '../../actions';

class Friends extends Component {
  constructor(props) {
    super(props);
    this.state = {
      //暂时只需要一个视图，所以这个也没有用到
      logoutStatus: '',
    }
    this.handleClick=this.handleClick.bind(this);
  };

  handleClick(event){
    if(event.target.className="sureButton"){
      this.props.logout(
        ()=>{
          this.props.changeToNoneViewStatus();
        },
        ()=>{
          //若登出失败，也简单的关掉该视图
          this.props.changToNoneViewStatus();
        }
      )
    }
  }

  render() {
    return (
      <div className="firendsView">
        <div className="viewHeader">
          <p className="viewHeaderText">friends</p>
          <div className="closeButton" onClick={this.props.changeToNoneViewStatus}>x</div>
        </div>
        <div className="viewContent">
          <div className="friendsSettings">
            <div className="addGroup"></div>
            <div className="addFriends"></div>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    logoutStatus: state.user.logoutStatus,
    error: state.user.error
  }
}
const mapDispatchToProps = {
  changeToNoneViewStatus: headerViewActionCreators.changeToNoneViewStatus,
  logout
}

export default connect(mapStateToProps, mapDispatchToProps)(Logout);