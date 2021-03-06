import React, { Component } from 'react';
import { connect } from 'react-redux';

import { actionCreators as headerViewActionCreators } from '../../../shell/components/header';
import { showError } from '../../../util';

import {
  register,
  login,
  verifyEmail
} from '../../actions';
import RegisterView from './components/registerView';
import VerifyEmailView from './components/verifyEmailView';

class Register extends Component {
  constructor(props) {
    super(props);
    this.state = {
      //现在需要两个试图了，一个是注册视图，第二个视图为验证邮箱的视图,如果是第一个视图则为布尔值true，第二个则为布尔值false
      registerViewStatus: true,
      firstViewData: ''
    }
    this.toggleView = this.toggleView.bind(this);
    this.logViewData = this.logViewData.bind(this);
  };

  toggleView() {
    this.setState({
      ...this.state,
      registerViewStatus: !this.state.registerViewStatus
    });
  }

  logViewData(name, data) {
    this.setState({
      ...this.state,
      [name]: data
    });
  }

  render() {
    console.log(this.props.registerStatus, status.REGISTER_STATUS_BEFORE_SUCCESS);
    return (
      <div className="registerView">
        <div className="viewHeader">
          <p className="viewHeaderText">注册</p>
          <div className="closeButton" onClick={this.props.changeToNoneViewStatus}>x</div>
        </div>
        {this.state.registerViewStatus?
          <RegisterView 
            register={this.props.register}
            registerStatus={this.props.registerStatus}
            toggleView={this.toggleView}
            logViewData={this.logViewData}
          />:
          <VerifyEmailView
            firstViewData={this.state.firstViewData}
            changeToNoneViewStatus={this.props.changeToNoneViewStatus}
            login={this.props.login}
            verifyEmail={this.props.verifyEmail}
            verifyEmailStatus={this.props.verifyEmailStatus}
          />}
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    registerStatus: state.user.registerStatus,
    verifyEmailStatus: state.user.verifyEmailStatus
  }
}
const mapDispatchToProps = {
  changeToNoneViewStatus: headerViewActionCreators.changeToNoneViewStatus,
  register,
  login,
  verifyEmail
}

export default connect(mapStateToProps, mapDispatchToProps)(Register);