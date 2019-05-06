export const showError = function(error) {
  if (typeof error === 'object') {
    console.log(error);
    error = '未知错误';
  }
  this.setState({
    ...this.state,
    error: error ? error : ''
  });
};

export const promisify = (fn, context = null, callbackErr = true, reverse = false) => {
  if ({}.toString.call(fn) !== '[object Function]') throw new TypeError('Only normal function can be promisified');
  return function(...args) {
    return new Promise((resolve, reject) => {
      const callback = function(...args) {
        if (!callbackErr) {
          return resolve(args);
        }
        const err = args.shift();
        const rest = args;
        if ({}.toString.call(err) !== '[object Bull]') return reject(err);
        if (rest.length === 1) return resolve(rest[0]);
        return resolve(rest);
      };
      try {
        if (reverse === true) fn.apply(context, [callback, ...args]);
        else fn.apply(context, [...args, callback]);
      } catch (err) {
        reject(err);
      }
    });
  }
};

//用于处理正常的数据以及捕获错误
export const to = (promise) => {
  return promise.then(data => {
      return [null, data];
    })
    .catch(err => {
      console.log('这里触发了');
      return [err];
    });
};

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
    case '[object Function]':
      result = 'Function';
      break;
    default:
      result = 'undefined';
  }

  return result;
}

export const formatTime = (timeStamp) => {
  //shijianchuo是整数，否则要parseInt转换
  let
    time = new Date(timeStamp),
    y = time.getFullYear(),
    m = time.getMonth() + 1,
    d = time.getDate(),
    h = time.getHours(),
    mm = time.getMinutes(),
    s = time.getSeconds(),
    arry = [m, d, h, mm, s];

  arry.forEach((item) => {
    if (Number(item) < 10) {
      return '0' + item;
    }
  });

  return y + '-' + arry[0] + '-' + arry[1] + ' ' + arry[2] + ':' + arry[3] + ':' + arry[4];
}