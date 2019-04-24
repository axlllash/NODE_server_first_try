import io from 'socket.io-client';
import { isType } from '../util';

let
  io, socket,
  initBool = false,
  emitPromise=(socket,command)=>{
    socket.emit(command,(response)=>{
      return Promise.reslove(response);
    });
  };

// socket = io.connect('/');
// socket.on('connect', () => {
//   console.log('has connected。');
//   socket.on('test', (data) => {
//     console.log(data);
//   });
//   socket.emit('test', { test: 'test' });
// })

const initSocket = ({ groups }) => {
  //先验证传入的数据,服务器端已验证数组为0的情况，因此不用担心
  if (isType(groups) !== 'Array') {
    //为非法的操作，因此无后续处理
    return false;
  }

  socket = io.connect('/');

  //

  //初始化所有组，即在线用户对于每个组都加入room
  socket.emit('server_joinGroupRooms', { groups });


  initBool = true;
}