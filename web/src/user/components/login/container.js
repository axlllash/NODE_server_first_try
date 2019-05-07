import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';

import { actionCreators as headerViewActionCreators } from '../../../shell/components/header';
import { showError } from '../../../util';
import url from '../../../constants';

import { login, loginFail } from '../../actions';
import * as status from '../../constants';

class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userName: '',
      password: '',
      error: '',
      loginButtonEnable: true,
      // 这个是用于页面切换，暂时还没有用到
      loginViewStatus: '',
    }
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.showError = showError.bind(this);
  };

  handleChange(e) {
    this.setState({
      ...this.state,
      [e.target.name]: e.target.value,
    });
  };

  handleSubmit(e) {
    e.preventDefault();
    // 检验是否为空
    if (this.state.userName && this.state.password && this.state.loginButtonEnable) {
      // 将按钮暂时设为不可点击
      this.setState({
        ...this.state,
        loginButtonEnable: false
      });
      this.props.login(
        this.state.userName,
        this.state.password,
        false,
        false,
        () => {
          //成功的回调函数
          this.props.changeToNoneViewStatus();
        },
        (error) => {
          if (error.code) {
            switch (error.code) {
              case 2:
                error = '用户名或密码错误';
                //这里以后可以添加一个自动focus
                break;
              case 3:
                error = '非法错误';
                break;
              default:
                break;
            }
          }
          //失败的回调函数
          this.showError(error);
          //恢复点击
          this.setState({
            ...this.state,
            loginButtonEnable: true
          });
        }
      );
    } else {
      this.showError('用户名或密码不能为空。');
    }
  };

  handleBlur(e) {
    const name = e.target.name;
    let err = '';
    if (!this.state[name]) {
      switch (name) {
        case 'userName':
          {
            err = "用户名不能为空！";
            break;
          }
        case 'password':
          {
            err = "密码不能为空";
            break;
          }
        default:
          break;
      }
    }

    //清除之前的错误,当不传入参数时即清除
    this.showError(err);
  }

  render() {
    return (
      <div className="loginView">
        <div className="viewHeader">
          <div className="headerText">登录</div>
          <div className="closeButton" onClick={this.props.changeToNoneViewStatus}>x</div>
        </div>
        <div className="viewContent">
          <form onSubmit={this.handleSubmit}>
            <label htmlFor="loginUserName">用户名</label>
            <input 
              type="text" 
              id="loginUserName" 
              name="userName" 
              onChange={this.handleChange} 
              onBlur={this.handleBlur}
              value={this.state.userName} 
            />
            <label htmlFor="loginPassword">密码</label>
            <input 
              type="password" 
              id="loginPassword"
              name="password" 
              onChange={this.handleChange} 
              onBlur={this.handleBlur}
              value={this.state.password} 
            />
            <input 
              type="submit" 
              id="loginButton" 
              value={
                this.props.loginStatus===status.LOGIN_STATUS_BEFORE_SUCCESS?
                  '登录成功':'Sign In'
              } 
            />
          </form>
          <div className="errorZone">{this.state.error}</div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    loginStatus: state.user.loginStatus,
  }
}
const mapDispatchToProps = {
  changeToNoneViewStatus: headerViewActionCreators.changeToNoneViewStatus,
  login
}

export default connect(mapStateToProps, mapDispatchToProps)(Login);