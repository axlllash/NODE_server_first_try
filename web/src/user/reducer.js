import * as actionTypes from './actionTypes';

import * as status from './constants';

const initialState = {
  userName: '',
  userData: '',
  loginStatus: status.LOGIN_STATUS_NOT_START,
  registerStatus: false,
  logoutStatus:false
};

export default (state = initialState, action) => {
  switch (action.type) {
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
          logoutStatus:''
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
          registerStatus:status.REGISTER_STATUS_SUCCESS
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
          registerStatus:''
        }
      }
    case actionTypes.USER_LOGOUT_FAIL:
      {
        return {
          ...state,
          logoutStatus:status.LOGOUT_STATUS_FAIL,
          logoutStatusError:action.payload.error
        }
      }
    default:
      {
        return state;
      }
  }
}