import React, { Component } from 'react';
import { connect } from 'react-redux';

import User from '../../../user';
// 因为循环引用产生的bug，故引入action而不是user
import { login } from '../../../user/actions';
import Menu from '../../../menu';

import * as actionCreators from './actions';


class Header extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    // 初次加载好后，携带cookie向服务器验证该IP是否还在登录期间
    this.props.login(null, null, true, () => {
      this.props.changeToNoneViewStatus();
    });
  }

  render() {
    return (
      <header className="header">
        <User viewStatus={this.props.viewStatus} />
        {/*这里以后写其具体的view*/}
        {
          this.props.userName?
          {/*而Menu只不过是更方便登录后控制视图的一个模块*/}
          (<Menu 
            userName={this.props.userName}
            changeToLogoutViewStatus={this.props.changeToLogoutViewStatus} 
          />):
          (<div className="unloginView">
            <div 
              className="loginViewButton"
              role="loginViewButton" 
              onClick={this.props.changeToLoginViewStatus}>Sign In
            </div>
            <div 
              className="registerViewButton"
              role="registerViewButton" 
              onClick={this.props.changeToRegisterViewStatus}>Sign Up
            </div>
          </div>)
        }
      </header>
    );
  }
};

const mapStateToProps = (state) => {
  const userState = state.user;
  const headerState = state.header;
  return {
    viewStatus: headerState.viewStatus,
    userName: userState.userName,
    userData: userState.userData
  }
}

const mapDispatchToProps = {
  changeToNoneViewStatus: actionCreators.changeToNoneViewStatus,
  changeToLoginViewStatus: actionCreators.changeToLoginViewStatus,
  changeToRegisterViewStatus: actionCreators.changeToRegisterViewStatus,
  changeToLogoutViewStatus: actionCreators.changeToLogoutViewStatus,
  login
}

export default connect(mapStateToProps, mapDispatchToProps)(Header);