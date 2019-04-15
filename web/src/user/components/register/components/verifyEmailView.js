import React from 'react';

import { showError } from '../../../../util';

import * as status from '../../../constants';

class RegisterView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      verifyCode: '',
      verifyEmailButtonEnabl: true,
      error: '',
    }
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.showError = showError.bind(this);
  };

  handleSubmit(event) {
    event.preventDefault();
    if (this.state.verifyCode &&
      this.state.registerButtonEnable) {
      //将按钮暂时设为不可点击
      this.setState({
        ...this.state,
        verifyEmailButtonEnable: false
      });

      //如果注册且验证代码成功，则直接登录
      this.props.verifyEmail(this.state.verifyCode,
        ({ userName, userData }) => {
          this.props.login(
            this.props.firstViewData.userName,
            this.props.firstViewData.password,
            false,
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
      this.props.showError('未填写完整，无法提交！');
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
          if (!this.state.userName) {
            error = '用户名不能为空。';
          }
          break;
        }
      default:
        break;
    }
    this.props.showError(error);
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

export default RegisterView;