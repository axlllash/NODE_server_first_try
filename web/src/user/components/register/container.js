import React, { Component } from 'react';
import { connect } from 'react-redux';

import { actionCreators as headerViewActionCreators } from '../../../shell/components/header';
import { showError, hideError } from '../../../util';

import * as status from '../../constants';
import {
  register,
  login
} from '../../actions';

class Register extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userName: '',
      password1: '',
      password2: '',
      registerButtonEnable: true,
      error: '',
      //暂时只需要一个视图，所以这个也没有用到
      registerStatus: '',
    }
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.showError = showError.bind(this);
  };

  handleSubmit(event) {
    event.preventDefault();
    if (this.state.userName && this.state.password1 && this.state.password2 &&
      this.state.password1 === this.state.password2 &&
      this.state.registerButtonEnable) {
      //将按钮暂时设为不可点击
      this.setState({
        ...this.state,
        registerButtonEnable: false
      });
      this.props.register(this.state.userName, this.state.password1, this.state.password2,
        () => {
          this.props.changeToNoneViewStatus();
          //如果注册成功，则直接登录
          this.props.login(this.state.userName, this.state.password1, true);
        },
        (error) => {
          this.showError(error);
          //恢复点击
          this.setState({
            ...this.state,
            registerButtonEnable: true
          });
        });
    } else {
      this.showError('未填写完整，无法提交！');
    }
  }

  handleChange(event) {
    this.setState({
      ...this.state,
      [event.target.name]: event.target.value
    });
  };

  handleBlur(event) {
    let
      error = '',
      name = event.target.name;
    switch (name) {
      case 'userName':
        {
          if (!this.state.userName) {
            error = '用户名不能为空。';
          }
          break;
        }
      case 'password1':
        {
          if (!this.state.password1) {
            error = '第一次输入的密码不能为空。';
          }
          break;
        }
      case 'password2':
        {
          if (!this.state.password2) {
            error = '第二次输入的密码不能为空。';
          } else if (this.state.password1 !== this.state.password2) {
            error = '两次密码不一致';
          }
          break;
        }
      default:
        break;
    }
    this.showError(error);
  }

  render() {
    console.log(this.props.registerStatus,status.REGISTER_STATUS_BEFORE_SUCCESS);
    return (
      <div className="registerView">
        <div className="viewHeader">
          <p className="viewHeaderText">注册</p>
          <div className="closeButton" onClick={this.props.changeToNoneViewStatus}>x</div>
        </div>
        <div className="viewContent">
          <form onSubmit={this.handleSubmit}>
            <label htmlFor="registerUserName">用户名</label>
            <input
              type="text"
              id="registerUserName"
              name="userName"
              onChange={this.handleChange}
              onBlur={this.handleBlur}
              value={this.state.userName}
            />
            <label htmlFor="registerPassword1">输入密码</label>
            <input
              type="password"
              id="registerPassword1"
              name="password1"
              onChange={this.handleChange}
              onBlur={this.handleBlur}
              value={this.state.password1}
            />
            <label htmlFor="registerPassword1">请再次输入密码</label>
            <input
              type="password"
              id="registerPassword2"
              name="password2"
              onChange={this.handleChange}
              onBlur={this.handleBlur}
              value={this.state.password2}
            />
            <input
              type="submit"
              id="registerButton"
              value={
                this.props.registerStatus === status.REGISTER_STATUS_BEFORE_SUCCESS?
                '注册成功':'Sign Up'
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
    registerStatus: state.user.registerStatus,
  }
}
const mapDispatchToProps = {
  changeToNoneViewStatus: headerViewActionCreators.changeToNoneViewStatus,
  register,
  login
}

export default connect(mapStateToProps, mapDispatchToProps)(Register);