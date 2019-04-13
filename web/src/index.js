import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import store from './store';
import Shell from './shell';

ReactDOM.render(
  <Provider store={store}>
    <Router>
      <Shell />
    </Router>
  </Provider>,
  document.getElementById('root')
);