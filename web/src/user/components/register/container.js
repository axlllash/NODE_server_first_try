import React, { Component } from 'react';
import { connect } from 'react-redux';

import { actionCreators as headerViewActionCreators } from '../../../shell/components/header';
import { showError } from '../../../util';

import {
  register,
  login
} from '../../actions';
import RegisterView from './components/reigsterView';
import VerifyEmailView from './components/verifyEmailView';

class Register extends Component {
  constructor(props) {
    super(props);
    this.state = {
      //现在需要两个试图了，一个是注册视图，第二个视图为验证邮箱的视图,如果是第一个视图则为布尔值true，第二个则为布尔值false
      registerViewStatus: '',
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
      ...state,
      firstViewData: data
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
        {registerViewStatus?
          <RegisterView 
            register={this.props.register}
            registerStatus={this.props.registerStatus}
            toggleView={this.toggleView}
            logViewData={this.logViewData}
          />:
          <VerifyEmailView
            firstViewData={this.state.firstViewData}
            changeToNoneViewStatus={this.props.changeToNoneViewStatus}
            login={this.porps.login}
          />}
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
  register,
  login
}

export default connect(mapStateToProps, mapDispatchToProps)(Register);