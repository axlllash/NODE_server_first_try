//必须socket模块先加载好
import io from 'socket.io-client';
import {
  isType,
  promisify,
  to
} from '../util';

let
  io, socket,
  initBool = false,
  socket_emit,
  socket_on,
  socketFuncPromisify = (socket) => {
    socket_emit = promisify(socket.emit, socket, false);
    socket_on = promisify(socket.on, socket, false);
  };

export const initSocket = (whenReceiveMessagesAmount, whenReceiveGroupMessages) => {
  //这样写是为了将错误处理也能够链式调用处理
  return Promise.resolve()
    .then(async () => {
      let
        err = null,
        result, i;
      //如连接成功，则有socket
      socket = io.connect('/');

      //socket的方法promisify化
      socketFuncPromisify(socket);

      //监听服务器端发来的好友未读消息数量
      sokcet_on('client_receiveMessagesAmount')
        .then(([{ unreadMessagesAmountData }] )=> {
          if (unreadMessagesAmountData) {
            whenReceiveMessagesAmount(unreadMessagesAmountData);
          } else {
            throw 'something wrong';
          }
        })
        .catch(err => {
          throw err;
        });

      //监听服务器发来的新的群组消息
      socket_on('client_receiveMessagesFromGroup')
        .then(([{ groupMessages }]) => {
          whenReceiveGroupMessages(groupMessages);
        })
        .catch(err => {
          throw err;
        })

      //初始化所有组，即在线用户对于每个组都加入room,
      [err, result] = await to(socket_emit('server_joinGroupRooms'))
        .then(([err,[result]])=>[err,JSON.parse(result)]);
      //在async函数中throw会直接返回rejected的promise，可以在catch里处理
      if (err || Number(result.code) !== 1) throw err ? err : 'something wrong.';

      //到这里用户的所有组已经被server监听了,初始化获得friends未读消息数量和所有的群消息
      [err, [{ code, unreadMessagesAmountData, groupMessages, unreadGroupMessagesAmountData }]] = await to(socket_emit('server_initFriendMessagesAndGroupsMessages'));
      if (err || Number(code) !== 1) throw err ? err : 'something wrong.';

      return {unreadGroupMessagesAmountData,groupMessages,unreadGroupMessagesAmountData};
    })
    .catch(err => {
      //交给外部继续处理错误
      throw err;
    });
}

export socket_emit;