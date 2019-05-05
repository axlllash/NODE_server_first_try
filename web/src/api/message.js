import {
  isType,
  to
} from '../util';

import { initSocket, socket_emit } from './socket';

let
  //messages是以userName为key，groupMessages是以groupName为键
  data = {
    messages: {}, //这个根据用户需要是否存本地
    groupMessages: {}, //这个不用存本地，依赖服务器
    unreadMessagesAmountData: {}, //这个也不用存本地，依赖服务器
    unreadGroupMessagesAmountData: {}, //这个需要存本地，则客户端的群未读消息数量为客户端的未读消息加上服务器发来的数据
    currentChatWith: '',
    currentGroup: ''
  },
  funcsArrayUpdateMessagesPassAmount = [],
  funcsArrayUpdateMessagesPassMessages = [],
  funcsArrayUpdateMessagesPassAllMessages = [],
  funcsArrayUpdateGroupMessagesPassAmount = [],
  funcsArrayUpdateGroupMessagesPassMessages = [],
  funcsArrayUpdateGroupMessagesPassAllMessages = [],
  storeMessagesBool;

//使用前得先注册回调函数
export const initMessages = async (args) => {
  let
    userName = args.userName,
    //这里的friends只指由姓名组成的数组，而非对象的集合，groups同理
    friends = args.friends,
    groups = args.groups,
    localData = JSON.parse(localStorage.getItem(`vrain:${userName}`));

  //storeMessageBool无论用户是否同意，都会存在本地(这里存字符串)，groupMessagesAmountData也是
  storeMessagesBool = localData ?
    Boolean(localData.storeMessagesBool) : false;

  //这里的缓存是指本地缓存
  if (storeMessagesBool) {
    //则先从缓存中加载数据
    //这里默认一个事实，服务器上发来的新数据，时间一定比本地的新
    //群消息通过服务器完成缓存
    //然后再根据传入的friends数组，更新数据
    friends.forEach((i) => {
      if (!(friends[i] in localData.messages)) {
        data.messages[friends[i]] = [];
      } else {
        data.messages[friends[i]] = localData.messages[friends[i]];
      }
    });
  }

  //初始化群消息以及从本地提取群消息数量，群的未读消息数量也保存在本地，而不受用户同意限制
  groups.forEach((i) => {
    data.groupMessages[groups[i]] = [];
    if (!(groups[i] in localData.unreadGroupMessagesAmountData)) {
      data.unreadGroupMessagesAmountData[groups[i]] = [];
    } else {
      data.unreadGroupMessagesAmountData[groups[i]] = localData.unreadGroupMessagesAmountData[groups[i]]
    }
  });

  //初始化socket
  [err, { unreadGroupMessagesAmountData, groupMessages, unreadGroupMessagesAmountData }] = await to(initSocket(whenReceiveMessagesAmount, whenReceiveGroupMessages));

  updateUnreadAmountWhenInit({ unreadGroupMessagesAmountData, groupMessages, unreadGroupMessagesAmountData });

  return true;
}

export const sendMessage = async (message) => {
  let
    //组特有
    groupBool = message.groupBool,
    groupName = message.groupName,
    //普通消息特有
    toWho = message.to,
    //共有的
    fromWho = message.from,
    content = message.content,
    date = (new Date()).toValueOf(),
    err, code;
  if (fromWho && content && date) {
    if (groupBool && groupName) {
      [err, { code }] = await to(socket_emit('server_handleMessagesFromClient', message));
      if (err) console.log(err);
      if (Number(code) === 1) {
        //群消息会自动更新，因此不用管
        return true;
      }
    } else if (toWho) {
      //开始更新
      needMessagesToUpdate({
        [toWho]: [message]
      });

    }
  }
}

//这个函数是给页面初始化调用的，是页面的初始化
export const whenAllMessagesToUpdate = async () => {
  let
    err;
  //data.currentChatWith必定存在，不在即报错
  if (data.currentChatWith) {
    [err, unreadMessagesAmountData] = await to(askMessagesToUpdate(true));
    if (err) console.log(err);

    //开始更新未读消息数量
    if (unreadMessagesAmountData) {
      needMessagesAmountToUpdate(unreadMessagesAmountData);
    }
  }
};

export const whenAllGroupMessagesToUpdate = () => {
  //同理，理论上必定存在
  if (data.currenGroup) {
    needGroupMessaagesToUpdate(null, true);
    groupMessagesAmountDataUpdate();
  }
}

export const toggleMessagesBool = (bool) => {
  if (typeof bool === 'boolean') {
    storeMessagesBool = bool;
  } else {
    throw 'not a bool!';
  }
}

export const changeCurrentChatWithOrGroup = (name, groupBool) => {
  if (groupBool) {
    data.currenGroup = name;
  } else {
    data.currentChatWith = name;
  }
}

//初次init的时候也需要未读消息数量
const updateUnreadAmountWhenInit = ({ unreadGroupMessagesAmountData, groupMessages, unreadGroupMessagesAmountData }) => {

  if (unreadMessagesAmountData && groupMessages && unreadGroupMessagesAmountData) {
    let
      i, temp;

    needMessagesAmountToUpdate(unreadMessagesAmountData);
    storeGroupMessages(groupMessages);
    for (i in unreadGroupMessagesAmountData) {
      if (unreadGroupMessagesAmountData[i].hasOwnProperty(i)) {
        if (data.unreadGroupMessagesAmountData[i]) {
          temp = data.unreadGroupMessagesAmountData[i] + unreadGroupMessagesAmountData[i];
          if (temp < 99) {
            data.unreadGroupMessagesAmountData[i] = temp;
          } else {
            data.unreadGroupMessagesAmountData[i] = 99;
          }
        }
      }
    }
  }
}
//这里是被动接受的处理函数,也是当有新消息来，该怎么处理的全过程
const whenReceiveMessagesAmount = async (unreadMessagesAmountData) => {
  let
    err;
  if (unreadMessagesAmountData) {
    if (data.currentChatWith && (data.currentChatWith in unreadMessagesAmountData)) {
      //如果当前用户正在和某人聊天，且未读消息数量里有该好友，则向服务器申请要消息
      //这里要确保是用户的好友，后端有验证
      //这里是被动更新，理论上传来的未读消息数组就一条信息
      //若到了这里unreadMessagesAmountData会自动更新
      //这里的更新，主要是当前正在聊的用户，未读消息数量变为了0
      [err, unreadMessagesAmountData] = await to(askMessagesToUpdate(false));
      if (err) console.log(err);
    }
    //也有可能用户没有打开聊天界面，所以只更新未读消息数量
    needMessagesAmountToUpdate(unreadMessagesAmountData);

  } else {
    console.log('something wrong.');
  }
}

const whenReceiveGroupMessages = async (groupMessages) => {
  let
    bool;

  bool = storeGroupMessages(groupMessages);

  if (bool) {
    //若存储成功，则先调用未读数量通知，再调用传递具体消息的函数
    needGroupMessaagesToUpdateAmount(groupMessages);
    needGroupMessagesToUpdate(groupMessages, false);
  }
};

const storeGroupMessages = (groupMessages) => {
  let
    i;
  for (i in groupMessages) {
    if (groupMessages.hasOwnProperty(i)) {
      if (isType(groupMessages[i]) === 'Array') {
        data.groupMessages[i].push(...groupMessages[i]);
        return true;
      } else {
        console.log('someting wrong.');
        return false;
      }
    } else {
      console.log('something wrong.');
      return false;
    }
  }
}

const needGroupMessaagesToUpdateAmount = (groupMessages) => {
  let
    i;
  for (i in groupMessages) {
    if (data.unreadGroupMessagesAmountData[i] && data.unreadGroupMessagesAmountData[i] < 99) {
      data.unreadGroupMessagesAmountData[i] = data.unreadMessagesAmountData[i] + groupMessages[i].length;
    }
  }

  //若当前正在某个组聊天，则将该组未读消息数量清零
  if (data.currentGroup) {
    data.unreadGroupMessagesAmountData[data.currentGroup] = 0;
  }

  groupMessagesAmountDataUpdate();
}

const groupMessagesAmountDataUpdate = () => {
  funcsArrayUpdateGroupMessagesPassAmount.forEach((func) => {
    func(data.unreadGroupMessagesAmountData);
  });
}

const needGroupMessagesToUpdate = (groupMessages, allBool) => {
  if (allBool && data.currenGroup) {
    funcsArrayUpdateGroupMessagesPassAllMessages.forEach((func) => {
      func(data.groupMessages[data.currentGroup]);
    })
  } else if (data.currentGroup) {
    funcsArrayUpdateGroupMessagesPassMessages.forEach((func) => {
      func(groupMessages[currenGroup]);
    })
  }
}

//拿整理好的数据去填，然后显式地更新,去更新页面上的数据，再整理数据
//该函数会返回未读消息数量，因此得配合needMessagesAmountToUpadate
const askMessagesToUpdate = async (allBool) => {
  let
    err, bool,
    unreadMessages = {},
    unreadMessagesAmountData;
  [err, { unreadMessages[data.currentChatWith], unreadMessagesAmountData }] = await to(socket_emit('server_sendMessages', chatWith));
  if (err) console.log(err);
  //因为是被动响应，所以tempData理论上是必定有值的
  //先整理数据
  bool = needMessagesToUpdate(unreadMessages, allBool);
  //这里完成后，返回unreadMessagesAmountData
  if (bool) {
    return { unreadMessagesAmountData };
  }
};

//传入的是一个对象
const needMessagesToUpdate = (unreadMessages, allBool = false) => {
  let
    i;
  for (i in unreadMessages) {
    if (unreadMessages.hasOwnProperty(i)) {
      if (isType(unreadMessages[i]) === 'Array' && data.currentChatWith) {
        data.messages[i].push(...unreadMessages[i]);

        //这里判断是需要更新部分，还是更新整体
        if (allBool) {
          funcsArrayUpdateMessagesPassAllMessages.forEach((func) => {
            if (isType(func) === 'Function') {
              func(data.messages[data.currentChatWith]);
            }
          });
        } else {
          funcsArrayUpdateMessagesPassMessages.forEach((func) => {
            if (isType(func) === 'Function') {
              func(unreadMessages[data.currentChatWith]);
            }
          });
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
};

const needMessagesAmountToUpdate = (unreadMessagesAmountData) => {
  //先存数据，然后调用函数组以通知有新消息
  data.unreadMessagesAmountData = unreadMessagesAmountData;

  //传入未读数量给函数组
  funcsArrayUpdateMessagesPassAmount.forEach((func) => {
    if (isType(func) === 'Function') {
      func(unreadMessagesAmountData);
    }
  });
}