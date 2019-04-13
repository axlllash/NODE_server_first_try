import React from 'react';
import {Switch,Route} from 'react-router-dom';

import APP_blog from '../../../APP_blog';
import Home from '../../../home';

const Content=()=>(
    <Switch>
      <Route exact path="/" component={Home} />
      <Route path="/app_blog" component={APP_blog} />
    </Switch>
);

export default Content;