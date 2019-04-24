export const showError = function(error) {
  if (typeof error === 'object') {
    console.log(error);
    error = '未知错误';
  }
  this.setState({
    ...this.state,
    error: error ? error : ''
  });
}

//判断数组还是对象
export const isType = (obj) => {
  var
    type = Object.prototype.toString.call(obj),
    result;
  switch (type) {
    case '[object Array]':
      result = 'Array';
      break;
    case '[object Object]':
      result = 'Object';
      break;
    case '[object String]':
      result = 'String';
      break;
    case '[object Boolean]':
      result = 'Boolean';
      break;
    case '[object Number]':
      result = 'Number';
      break;
    case '[object Null]':
      result = 'Null';
      break;
    case '[object RegExp]':
      result = 'RegExp';
      break;
    default:
      result = 'undefined';
  }

  return result;
}