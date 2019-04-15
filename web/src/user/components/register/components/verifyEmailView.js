import React, { Component } from 'react';

import { showError } from '../../../../util';

import * as status from '../../../constants';

const verifyCodeReg = /^\d{6}$/;

class VerifyEmailView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      verifyCode: '',
      verifyEmailButtonEnable: true,
      error: '',
    }
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.showError = showError.bind(this);
  };

  handleSubmit(event) {
    event.preventDefault();
    debugger;
    if (this.state.verifyCode && this.state.verifyEmailButtonEnable &&
      verifyCodeReg.test(Number(this.state.verifyCode))) {
      //将按钮暂时设为不可点击
      this.setState({
        ...this.state,
        verifyEmailButtonEnable: false
      });

      //如果注册且验证代码成功，则直接登录
      this.props.verifyEmail(this.state.verifyCode,
        () => {
          this.props.login(
            this.props.firstViewData.userName,
            this.props.firstViewData.password,
            false,
            true,
            () => {
              //成功的回调函数
              this.props.changeToNoneViewStatus();
            },
            (error) => {
              //失败的回调函数
              this.showError(error);
              //恢复点击
              this.setState({
                ...state,
                verifyEmailButtonEnable: true
              });
            }
          );
        },
        (error) => {
          this.showError(error);
          //恢复点击
          this.setState({
            ...this.state,
            verifyEmailButtonEnable: true
          });
        }
      );
    } else {
      this.showError('请输入正确信息。');
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
      case 'verifyCode':
        {
          if (!this.state.verifyCode) {
            error = '邮箱验证码不能为空。';
          } else if (!verifyCodeReg.test(Number(this.state.verifyCode))) {
            error = '验证码为6位数字';
            break;
          }
        }
      default:
        break;
    }
    this.showError(error);
  }

  render() {
    return (
      <div className="viewContent">
        <form onSubmit={this.handleSubmit}>
          <label htmlFor="verifyCode">请输入您收到的邮箱验证码。</label>
          <input
            type="text"
            id="verifyCode"
            name="verifyCode"
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            value={this.state.userName}
          />
          <input
            type="submit"
            id="verifyEmailButton"
            value={
              this.props.verifyEmailStatus === status.VERIFY_EMAIL_STATUS_BEFORE_SUCCESS?
              '注册成功':'提交'
            }
          />
        </form>
        <div className="errorZone">{this.state.error}</div>
      </div>
    );
  }
}

export default VerifyEmailView;