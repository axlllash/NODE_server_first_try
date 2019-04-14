//测试数据
import { url } from '../constants';

import * as actionTypes from './actionTypes';

//设置三个模块变量，以防止请求竞争
const REQ_ID = {
  currentLoginReqId: 0,
  currentRegisterReqId: 0,
  currentLogoutReqId: 0
}

//登录界面提示用户登录成功所需要的时间
const loginBeforeSuccessTime = 2000;
//首次加载并不需要提示用户成功,注册后自动登录也不需要，所以暂时设为0
const loginBeforeSuccessShortTime = 0;
//注册界面提示用户注册成功所需要的时间
const registerBeforeSuccessTime = 2000;

//一个配合上面设置的简单公用方法
const dispatchIfValidPublic = (dispatch, reqId, name) => (action, currentReqId) => {
  if (reqId === REQ_ID[name]) {
    return dispatch(action);
  }
}

//正常的登录，传递给mapDispatchToProps的
export const login = (userName, password, shortTimeBool, callback, callbackForError) => (dispatch, getState) => {
  const loginReqId = ++REQ_ID.currentLoginReqId;

  const dispatchIfValid = dispatchIfValidPublic(dispatch, loginReqId, 'currentLoginReqId');

  //开始分发loginStart的action creators
  dispatchIfValid(loginStart());

  //开始向服务器端申请登录
  (shortTimeBool ? fetch(url.login) : fetch(url.login, {
    method: 'post',
    headers: {
      'Content - Type': 'application/json'
    },
    body: JSON.stringify({ userName, password })
  }))
  .then(res => {
      if (res.ok) {
        return res.json();
      } else {
        return Promise.reject('Something wrong when login.');
      }
    })
    .then(data => {
      const code = Number(data.code);
      if (code === 1) {
        dispatchIfValid(loginBeforeSuccess());
        setTimeout(() => {
          dispatchIfValid(loginSuccess(data.userName, data.userData))
          if (typeof callback === 'function') {
            callback();
          }
        }, (shortTimeBool ? loginBeforeSuccessShortTime : loginBeforeSuccessTime));
      } else if (code === 2) {
        return Promise.reject('用户名或密码错误。');
      }
    })
    .catch(error => {
      console.log(error);
      if (typeof callbackForError === 'function') {
        callbackForError(error);
      }
      dispatchIfValid(loginFail());
    });
};

// 以下是基本的action creators
export const loginStart = () => ({
  type: actionTypes.USER_LOGIN_START
});

export const loginSuccess = (userName, userData) => ({
  type: actionTypes.USER_LOGIN_SUCCESS,
  payload: {
    userName,
    userData
  }
});

export const loginBeforeSuccess = () => ({
  type: actionTypes.USER_LOGIN_BEFORE_SUCCESS,
});

export const loginFail = (error) => ({
  type: actionTypes.USER_LOGIN_FAIL,
  payload: {
    error
  }
});

//******************************************************************

export const register = (userName, password1, password2, callback, callbackForError) =>
  (dispatch, getState) => {
    const registerReqId = ++REQ_ID.currentRegisterReqId;

    const dispatchIfValid = dispatchIfValidPublic(dispatch, registerReqId, 'currentRegisterReqId');

    //开始分发loginStart的action creators
    dispatchIfValid(registerStart());

    fetch(url.register, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userName, password1, password2 })
      })
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          return Promise.reject('Something wrong when register');
        }
      })
      .then(data => {
        const code = Number(data.code);
        if (code === 1) {
          dispatchIfValid(registerBeforeSuccess());
          setTimeout(() => {
            dispatchIfValid(registerSuccess());
            if (typeof callback === 'function') {
              callback();
            }
          }, registerBeforeSuccessTime);
        }
      })
      .catch(error => {
        console.log(error);
        if (typeof callbackForError === 'function') {
          callbackForError();
        }
        dispatchIfValid(registerFail());
      });
  }

export const registerStart = () => ({
  type: actionTypes.USER_REGISTER_START
});

export const registerBeforeSuccess = () => ({
  type: actionTypes.USER_REGISTER_BEFORE_SUCCESS
});

export const registerSuccess = () => ({
  type: actionTypes.USER_REGISTER_SUCCESS
});

export const registerFail = () => ({
  type: actionTypes.USER_REGISTER_FAIL
});

//************************************************************************

export const logout = (callback, callbackForError) => (dispatch, getState) => {
  const logoutReqId = ++REQ_ID.currentLogoutReqId;

  const dispatchIfValid = dispatchIfValidPublic(dispatch, logoutReqId, 'currentLogoutReqId');

  //开始dispatch注销开始的action
  dispatchIfValid(logoutStart());

  fetch(url.logout)
    .then(res => {
      if (res.ok) {
        return res.json()
      } else {
        return Promise.reject('Something wrong when logout.');
      }
    })
    .then(data => {
      if (Number(data.code) === 1) {
        dispatchIfValid(logoutSuccess());
        if (typeof callback === 'function') {
          callback();
        }
      }
    })
    .catch(error => {
      console.log(error);
      if (typeof callbackForError === 'function') {
        callbackForError();
      }
      dispatchIfValid(logoutFail());
    })
}

export const logoutStart = () => ({
  type: actionTypes.USER_LOGOUT_START
});

export const logoutSuccess = () => ({
  type: actionTypes.USER_LOGOUT_SUCCESS
});

export const logoutFail = () => ({
  type: actionTypes.USER_LOGOUT_FAIL,
});