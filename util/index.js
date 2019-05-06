const createVerifyCode = () => {
  var Num = "";
  for (var i = 0; i < 6; i++) {
    Num += Math.floor(Math.random() * 10);
  }
  return Num;
};

const promisify = (fn, context = null, callbackErr = true, reverse = false) => {
  if ({}.toString.call(fn) !== '[object Function]') throw new TypeError('Only normal function can be promisified');
  return function(...args) {
    return new Promise((resolve, reject) => {
      const callback = function(...args) {
        if (!callbackErr) {
          console.log(args.length);
          return resolve(...args);
        }
        const err = args.shift();
        const rest = args;
        if ({}.toString.call(err) !== '[object Null]') return reject(err);
        if (rest.length === 1) return resolve(rest[0]);
        return resolve(...rest);
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
const to = (promise) => {
  return promise.then(data => {
      return [null, data];
    })
    .catch(err => [err]);
};

//判断数组还是对象
const isType = (obj) => {
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


exports.createVerifyCode = createVerifyCode;
exports.promisify = promisify;
exports.to = to;
exports.isType = isType;