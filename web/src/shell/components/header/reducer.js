import * as actionTypes from './actionTypes';

import * as status from './constants';

const initialState={
  viewStatus:status.HEADER_VIEW_STATUS_NONE
}

export default (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.TOGGLE_HEADER_STATUS_LOGIN:
      {
        return {
          ...state,
          viewStatus: status.HEADER_VIEW_STATUS_LOGIN,       
        }
      }
    case actionTypes.TOGGLE_HEADER_STATUS_REGISTER:
      {
        return {
          ...state,
          viewStatus: status.HEADER_VIEW_STATUS_REGISTER,
        }
      }
    case actionTypes.TOGGLE_HEADER_STATUS_LOGOUT:
      {
        return {
          ...state,
          viewStatus: status.HEADER_VIEW_STATUS_LOGOUT,
        }
      }
    case actionTypes.TOGGLE_HEADER_STATUS_NONE:
      {
        return{
          ...state,
          viewStatus:status.HEADER_VIEW_STATUS_NONE,
        };
      }
    default:
      {
        return state;
      }
  }
}