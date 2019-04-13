import * as actionTypes from './actionTypes';

export const changeToNoneViewStatus=()=>({
  type:actionTypes.TOGGLE_HEADER_STATUS_NONE,
});

export const changeToLoginViewStatus=()=>({
  type:actionTypes.TOGGLE_HEADER_STATUS_LOGIN,
});

export const changeToRegisterViewStatus=()=>({
  type:actionTypes.TOGGLE_HEADER_STATUS_REGISTER,
});

export const changeToLogoutViewStatus=()=>({
  type:actionTypes.TOGGLE_HEADER_STATUS_LOGOUT,
});