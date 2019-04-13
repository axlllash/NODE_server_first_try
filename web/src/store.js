import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import thunkMiddleware from 'redux-thunk';

import { reducer as appBlogReducer } from './APP_blog';
import { reducer as userReducer } from './user';
import { reducer as headerReducer } from './shell/components/header';

const reducer = combineReducers({
  APP_blog: appBlogReducer,
  user: userReducer,
  header: headerReducer
});

const middlewares = [thunkMiddleware];

//dispatch的时候尝试修改状态则会报错
if (process.env.NODE_ENV !== 'production') {
  middlewares.push(require('redux-immutable-state-invariant').default());
}

const storeEnhancers = compose(
  applyMiddleware(...middlewares),
  (window && window.devToolsExtension) ? window.devToolsExtension() : (f) => f,
);

export default createStore(reducer, {}, storeEnhancers);