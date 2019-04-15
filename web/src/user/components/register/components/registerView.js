import React, { Component } from 'react';

import { showError } from '../../../../util';

import * as status from '../../../constants';

const emailReg = /^([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/;
const passwordReg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;

class RegisterView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userName: '',
      password1: '',
      password2: '',
      email: '',
      //下面这两个还未实现
      avatar: 'avatar',
      customSettings: 'customSettings',
      registerButtonEnable: true,
      error: '',
    }
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.showError = showError.bind(this);
  };

  handleSubmit(event) {
    event.preventDefault();
    if (this.state.userName && this.state.password1 && this.state.password2 &&
      this.state.password1 === this.state.password2 && this.state.email &&
      emailReg.test(this.state.email) && this.state.registerButtonEnable &&
      passwordReg.test(this.state.password1)) {
      //将按钮暂时设为不可点击
      this.setState({
        ...this.state,
        registerButtonEnable: false
      });
      this.props.register({
          userName: this.state.userName,
          password1: this.state.password1,
          password2: this.state.password2,
          email: this.state.email,
          avatar: this.state.avatar,
          customSettings: this.state.customSettings
        },
        () => {
          //顺便记录下当前页面的值以移交给下一个页面
          this.props.logViewData('firstViewData',{ userName: this.state.userName, password: this.state.password1 });
          //如果注册成功，则跳转到验证邮箱页面
          this.props.toggleView();
        },
        (error) => {
          if(error.code){
            //到这里，即为服务器端传来的信息或错误
            switch (error.code) {
              //信息不完整，非法修改造成的
              case 3:
                error='非法操作。'
                break;
              case 4:
                error='账号已注册。'
                break;
              default:
                break;
            }
          }
          this.showError(error);
          //恢复点击
          this.setState({
            ...this.state,
            registerButtonEnable: true
          });
        });
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
          }else if(!passwordReg.test(this.state.password1)){
            error ='密码由8到16位的密码或数字组成。';
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
      case 'email':
        {
          if (!this.state.email) {
            error = '邮箱不能为空。';
          } else if (!emailReg.test(this.state.email)) {
            error = '请输入正确的邮箱格式。';
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
          <label htmlFor="registerEmail">请输入邮箱以获取验证码</label>
          <input 
            type="text"
            id="registerEmail"
            name="email"
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            value={this.state.email}
          />
          {/*这里加两个隐藏的input信息，分别为avatar和customSettings，还没想好怎么实现*/}
          {/*<input 
            type="hidden"
            id="registerAvatar"
            name="avatar"
            value="avatar"
          />
          <input 
            type="hidden"
            id="registerCustomSettings"
            name="customSettings"
            value="customSettings"
          />*/}
          <input
            type="submit"
            id="registerButton"
            value={
              this.props.registerStatus === status.REGISTER_STATUS_BEFORE_SUCCESS?
              '提交成功':'Sign Up'
            }
          />
        </form>
        <div className="errorZone"></div>
      </div>
    );
  }
}

export default RegisterView;