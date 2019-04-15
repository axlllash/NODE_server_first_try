import * as actionTypes from './actionTypes';

import * as status from './constants';

const initialState = {
  userName: '',
  userData: '',
  loginStatus: '',
  registerStatus: '',
  logoutStatus:'',
  verifyEmailStatus:''
};

export default (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.USER_VERIFY_EMAIL_START:
      {
        return {
          ...state,
          verifyEmailStatus: status.VERIFY_EMAIL_STATUS_START,
        }
      }
    case actionTypes.USER_VERIFY_EMAIL_SUCCESS:
      {
        return {
          ...state,
          verifyEmailStatus: status.VERIFY_EMAIL_STATUS_SUCCESS,
          loginStatus:'',
          registerStatus:'',
          logoutStatus:''
        }
      }
    case actionTypes.USER_VERIFY_EMAIL_BEFORE_SUCCESS:
      {
        return {
          ...state,
          verifyEmailStatus:status.VERIFY_EMAIL_STATUS_BEFORE_SUCCESS,
        }
      }
    case actionTypes.USER_VERIFY_EMAIL_FAIL:
      {
        return {
          ...state,
          verifyEmailStatus:status.VERIFY_EMAIL_STATUS_FAIL,
        }
      }
    case actionTypes.USER_LOGIN_START:
      {
        return {
          ...state,
          loginStatus: status.LOGIN_STATUS_START,
        }
      }
    case actionTypes.USER_LOGIN_SUCCESS:
      {
        return {
          ...state,
          userName: action.payload.userName,
          userData: action.payload.userData,
          loginStatus: status.LOGIN_STATUS_SUCCESS,
          registerStatus:'',
          logoutStatus:'',
          verifyEmailStatus:''
        }
      }
    case actionTypes.USER_LOGIN_BEFORE_SUCCESS:
      {
        return {
          ...state,
          loginStatus:status.LOGIN_STATUS_BEFORE_SUCCESS,
        }
      }
    case actionTypes.USER_LOGIN_FAIL:
      {
        return {
          ...state,
          loginStatus:status.LOGIN_STATUS_FAIL,
        }
      }
    case actionTypes.USER_REGISTER_START:
      {
        return {
          ...state,
          registerStatus:status.REGISTER_STATUS_START
        }
      }
    case actionTypes.USER_REGISTER_BEFORE_SUCCESS:
      {
        return {
          ...state,
          registerStatus:status.REGISTER_STATUS_BEFORE_SUCCESS
        }
      }
    case actionTypes.USER_REGISTER_SUCCESS:{
      {
        return {
          ...state,
          registerStatus:status.REGISTER_STATUS_SUCCESS,
          loginStatus:'',
          logoutStatus:'',
          verifyEmailStatus:''
        }
      }
    }
    case actionTypes.USER_REGISTER_FAIL:{
      {
        return {
          ...state,
          registerStatus:status.REGISTER_STATUS_FAIL
        }
      }
    }
    case actionTypes.USER_LOGOUT_START:
      {
        return {
          ...state,
          logoutStatus:status.LOGOUT_STATUS_START
        }
      }
    case actionTypes.USER_LOGOUT_SUCCESS:
      {
        return {
          ...state,
          userName:'',
          userData:'',
          logoutStatus:status.LOGOUT_STATUS_SUCCESS,
          loginStatus:'',
          registerStatus:'',
          verifyEmailStatus:''
        }
      }
    case actionTypes.USER_LOGOUT_FAIL:
      {
        return {
          ...state,
          logoutStatus:status.LOGOUT_STATUS_FAIL,
        }
      }
    default:
      {
        return state;
      }
  }
}