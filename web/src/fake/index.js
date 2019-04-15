import { url } from '../constants';

const fakeFetch = (url_param, options) => {
  console.dir(options);
  switch (url_param) {
    case url.login:
      {
        return Promise.resolve({
          ok: true,
          json: () => (Promise.resolve({ code: 1, userName: 'weiyu', userData: { email: '123' } }))
        });
        // return Promise.reject('wtf is going on!');
      }
    case url.logout:
      {
        return Promise.resolve({
          ok: true,
          json: () => (Promise.resolve({ code: 1 }))
        });
      }
    case url.register:
      {
        return Promise.resolve({
          ok: true,
          json: () => (Promise.resolve({ code: 1 }))
        });
      }
    case url.verifyEmail:
      {
        return Promise.resolve({
          ok: true,
          json: () => (Promise.resolve({ code: 1 }))
        });
      }
    default:
      break;
  }
}

export default fakeFetch;