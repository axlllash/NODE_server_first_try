import Header from './container';
import * as actionCreators from './actions';
import * as status from './constants';
import reducer from './reducer';

//引入静态文件
import './static/header.scss';

export default Header;
export {actionCreators,status,reducer};