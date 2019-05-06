//依赖项
const
  path = require('path'),
  express = require('express'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  redis = require('redis'),
  fs = require('fs'),
  Server = require('http').Server,
  //配置
  client = redis.createClient({ password: '123456ww' }),
  redisStore = require('connect-redis')(session),
  app = express(),
  server = Server(app),
  io = require('socket.io')(server),
  // 自己的模块
  sendEmail = require('./email'),
  log = require('./config/logs'),
  createVerifyCode = require('./util').createVerifyCode,
  promisify = require('./util').promisify,
  to = require('./util').to,
  isType = require('./util').isType;

//一些全局参数
const
  sessionOptions = {
    ciient: client,
    port: 6379,
    host: '127.0.0.1',
    logErrors: true,
    db: 2,
    pass: '123456ww'
  },
  verifyCodeReg = /^\d{6}$/,
  emailReg = /^([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/,
  passwordReg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/,
  //利用promisify来解决回调地狱
  app_all = promisify(app.all, app, false),
  app_post = promisify(app.post, app, false),
  app_get = promisify(app.get, app, false),
  app_delete = promisify(app.delete, app, false),
  app_put = promisify(app.put, app, false),
  client_set = promisify(client.set, client),
  client_get = promisify(client.get, client),
  client_on = promisify(client.on, client),
  client_hget = promisify(client.hget, client),
  client_hgetall = promisify(client.hgetall, client),
  client_hset = promisify(client.hset, client),
  client_hmset = promisify(client.hmset, client),
  client_hdel = promisify(client.hdel, client),
  client_exists = promisify(client.exists, client),
  client_incr = promisify(client.incr, client),
  io_on = promisify(io.on, io, false);

//依赖全局参数的配置
const
  sessionMiddleware = session({
    store: new redisStore(sessionOptions),
    secret: 'zhy2019',
    resave: true,
    saveUninitialized: false,
    // 30分钟
    cookie: {
      maxAge: 1000 * 60 * 30,
      path: '/',
      secure: false
    },
  });

//用于redis提示错误信息
client_on('error')
  .catch(err => {
    console.log('Error: ' + err)
  });

//使用session中间件
app.use(sessionMiddleware);
io.use(function(socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

//配置基础中间件
app.use(express.static(path.join(__dirname, './web/dist')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 日志
app.all("*", async (req, res, next) => {
  //响应开始时间
  const start = new Date();
  //响应间隔时间
  let ms;
  try {
    //开始进入到下一个中间件
    await next();
    ms = new Date() - start;
    //记录响应日志
    log.i(req, ms);
  } catch (error) {
    //记录异常日志
    ms = new Date() - start;
    log.e(req, error, ms);
  }
  console.log(`${req.method} ${req.url} - ${ms}ms-${res.statusCode}`);
});


//使用socket.io
io_on('connection')
  .then(async (socket) => {
    if (socket.request.session.userName) {
      const
        //将socket的几个方法promisify化
        socket_once = promisify(socket.once, socket, false),
        socket_on = promisify(socket.on, socket, false),
        socket_join = promisify(socket.join, socket, false),
        socket_emit = promisify(socket.emit, socket, false);
      let
        userName = socket.request.session.userName,
        id = socket.id,
        err = null;
      //一旦客户端连入，则保存其ID,以后还可能保存其他的数据
      [err] = await to(client_hset('onlineUser', userName, JSON.stringify({ id })));
      if (err) throw err;

      //断开连接监听
      socket_on('disconnect')
        .then(async (fn) => {
          [err] = await client_hdel('onlineUser', userName);
          if (err) throw err;
          //客户端传来的回调函数，便于客户端使用await
          fn({ code: 1 });
        })
        .catch(err => {
          console.log(err);
          socket.disconnect(true);
        });

      //上线即让用户加入所有组的room，这里只监听，因此不用await
      socket_once('server_joinGroupsRooms')
        .then(async (fn) => {
          //从数据库读取groups
          [err, groups] = await to(client_hget(`user:${userName}`, 'groups'))
            .then(([err, groups]) => [err, JSON.parse(groups)]);
          if (err) throw { err, fn };
          if (isType(groups) === 'Array' && groups.length > 0) {
            let
              onlineGroupMembers, i;
            [err] = await to(socket_join(groups));
            if (err) throw { err, fn };

            [err, onlineGroupMembers] = await to(client_get('onlineGroupMembers'))
              .then(([err, onlineGroupMembers]) => [err, JSON.parse(onlineGroupMembers)]);

            if (!onlineGroupMembers) {
              //如果不存在，则利用temp新建一个存放每个组在线用户的对象
              groups.foreach((groupName) => {
                onlineGroupMembers[groupName] = [];
              });
            }

            for (i in onlineGroupMembers) {
              if (onlineGroupMembers.hasOwnProperty(i)) {
                onlineGroupMembers[i].push(userName);
              }
            }

            //存储每个组当前在线的用户
            [err] = await to(client_set('onlineGroupMembers', onlineGroupMembers));
            if (err) throw { err, fn };
          }
          //当数组为0的时候， 也发送code:1
          //客户端传来的回调函数，便于客户端使用await
          fn({ code: 1 });
        })
        .catch(({ err, fn }) => {
          console.log(err);
          if (fn) fn(err);
          socket.disconnect(true);
        });

      //对于客户端初始化的时候，发送所有群消息，后续所有群消息则由服务器端自动发送
      //而普通好友消息，并不需要发送具体消息，只需要一个驱动，发送自上次登录以来所有未读消息
      //然后客户端自动去申请消息
      socket_once('server_initFriendsMessagesAndGroupsMessages')
        .then(async (fn) => {
          let
            unreadMessagesAmountData, i,
            groups, groupMessage = {},
            unreadGroupMessagesAmountData = {},
            tempData = {};
          //unreadMessagesAmountData是必定存在的，因此不用验证
          [err, { unreadMessagesAmountData, groups }] = await to(client_hgetall(`user:${userName}`))
            .then(([err, { unreadMessagesAmountData, groups }]) => [err, [JSON.parse(unreadMessagesAmountData), JSON.parse(groups)]]);
          if (err) throw { err, fn };

          //得到的是每个群的所有保存的消息，以及该用户在每个群的未读消息数量,tempData是用于接下来清除的
          await groups.forEach(async (groupName) => {
            [err, [groupMessages[groupName], unreadGroupMessagesAmountData[groupName], tempData[groupName]]] = await client_hgetall(`group:${groupName}`)
              .then(([err, result]) => [err, JSON.parse(result)])
              .then(([err, { groupMessages, groupMembersUnreadMessagesAmountData }]) => [err, [groupMessages, groupMembersUnreadMessagesAmountData[userName], groupMembersUnreadMessagesAmountData]]);
            if (err) throw { err, fn };
          });

          //发回数据给客户端     //三个都是对象，第一个以好友名为key，另外两个以组名为key
          fn({ code: 1, unreadMessagesAmountData, groupMessages, unreadGroupMessagesAmountData });

          //初始化后即可清除群消息记录
          for (i in tempData) {
            if (tempData.hasOwnProperty(i)) {
              tempData[i][userName] = 0;
            }
          }

          //stringify化
          tempData = JSON.stringify(tempData);

          await groups.forEach(async (groupName) => {
            [err, [groupMessages[groupName], unreadGroupMessagesAmountData[groupName]]] = await client_hset(`group:${groupName}`,
                groupName, tempData[groupName])
              .then(([err, result]) => [err, JSON.parse(result)])
              .then(([err, { groupMessages, groupMembersUnreadMessagesAmountData }]) => [err, [groupMessages, groupMembersUnreadMessagesAmountData[userName]]]);
            if (err) throw { err, fn };
          });
        })
        .catch(({ err, fn }) => {
          console.log(err);
          if (fn) fn(err);
          socket.disconnect(true);
        })

      //处理客户端发来的消息，既处理普通消息，也处理组的消息
      socket_on('server_handleMessagesFromClient')
        .then(async (message, fn) => {
          let
            toWho = message.to,
            fromWho = message.from,
            groupBool = messaage.groupBool,
            groupName = message.groupName,
            unreadMessages,
            unreadMessagesAmountData,
            toWhoId, bool;
          if (!groupBool) {
            if (!toWho || !fromWho) throw 'incomplete information.';
            [err, { unreadMessages, unreadMessagesAmountData }] = await to(client_hgetall(`user:${toWho}`))
              .then(([err, data]) => [err, JSON.parse(data)]);
            if (err) throw err;
            //此时可以去除掉toWho字段了
            delete message.to;

            unreadMessages = unreadMessages[fromWho].push(message);
            //记录未读消息数量
            unreadMessagesAmountData[fromWho] = unreadMessages[fromWho].length;
            //统一stringify化
            unreadMessages = JSON.stringify(unreadMessages);
            unreadMessagesAmountData = JSON.stringify(unreadMessagesAmountData);
            //然后开始存入redis
            [err] = await to(client_hmset(`user:${toWho}`,
              'unreadMessages', unreadMessages,
              'unreadMessagesAmountData', unreadMessagesAmountData));
            if (err) throw { err, fn };

            //现在开始确认接受方是否在线
            [err, { toWhoId }] = await to(client_hget('onlineUser', toWho));
            if (err) throw { err, fn };
            if (toWhoId) socket.to(id).emit('client_receiveMessagesAmount', { unreadMessagesAmountData });
            //成功，给客户端的回调
            fn({ code: 1 });
            //如果有这两字段，说明发的是群消息
          } else if (groupBool && groupName) {
            let
              groupMessages;

            [err, { groupMessages, groupMembersUnreadMessagesAmountData, groupMembers }] = to(client_hgetall(`group:${groupName}`))
              .then(([err, result]) => [err, JSON.parse(result)]);
            if (err) throw { err, fn };

            if (groupMessages) {
              //去除一个无关的key
              delete message.groupBool;
              //说明该群存在，则直接发送最新的消息给最新的用户
              socket.to(groupName).emit('client_receiveMessagesFromGroup', {
                groupMessages: {
                  [groupName]: [message]
                }
              });
              //去除一个无关的key
              delete message.groupName;
              //存进现有消息里
              groupMessages = JSON.parse(groupMessages).push(message);

              //这里判断一下群消息长度，若超过1000，只存储500条消息
              if (groupMessages.length > 1000) groupMessages = groupMessages.slice(-500);

              //开始获取所有在线的群用户,注意这里获得的是一个群的
              [err, onlineGroupMembers] = await to(client_hgetall('onlineGroupMembers'))
                .then(([err, allOnlineGroupMembers]) => [err, JSON.parse(allOnlineGroupMembers).groupName]);
              if (err) throw { err, fn };

              //在线的人未读消息数量直接清零
              //然而准确的说，客户端需要本地存储未读消息数量，所以实际的未读消息数量是客户端的历史记录加上服务器上的未读消息数量
              groupMembers.forEach((groupMember) => {
                if (onlineGroupMembers.indexOf(groupMember) !== -1) {
                  //说明该用户在线
                  //则未读消息记录直接清空
                  groupMembersUnreadMessagesAmountData[groupMember] = 0;
                } else if (groupMembersUnreadMessagesAmountData[groupMember] && groupMembersUnreadMessagesAmountData[groupMember] < 99) {
                  //最多存99未读消息记录，若不存在，则初始化
                  groupMembersUnreadMessagesAmountData[groupMember] = ++groupMembersUnreadMessagesAmountData[groupMember];
                } else {
                  groupMembersUnreadMessagesAmountData[groupMember] = 1;
                }
              });

              //开始为不在线的用户存储群消息,且存储未读消息数量
              [err] = await to(client_hset(`group:${groupName}`,
                'groupMessages', groupMessages,
                'groupMembersUnreadMessagesAmountData', groupMembersUnreadMessagesAmountData
              ));
              if (err) throw { err, fn };

              //操作成功
              fn({ code: 1 });
            } else {
              throw { err: 'invalid operation', fn }
            }
          }
        })
        .catch(({ err, fn }) => {
          console.log(err);
          fn(err);
          socket.disconnect(true);
        });

      //发送消息，响应客户端的emit，但是用不着发组消息，只针对来自朋友的消息
      socket_on('server_sendMessages')
        .then(async (friendUserName, fn) => {
          let
            unreadMessages, tempData1, tempData2,
            bool;

          [err, [unreadMessages, tempData1, tempData2]] = await to(client_hgetall(`user:${userName}`))
            .then(([err, data]) => [err, JSON.parse(data)])
            .then(([err, { unreadMessages, unreadMessagesAmountData, frineds }]) => {
              if (friendUserName in friends) {
                return [err, [unreadMessages[friendUserName], unreadMessages, unreadMessagesAmountData]]
              } else {
                throw { err: 'invalid operation.', fn };
              }
            });
          if (err) throw { err, fn };

          //一旦发送消息，该friendUserName的未读消息都得清空，未读消息数量也得清空
          tempData1[friendUserName] = [];
          tempData2[friendUserName] = 0;

          //unreadMessage必定存在，但是否为空不得而知
          fn({ unreadMessages, unreadMessagesAmountData: tempData2 });

          //统一stringify化
          tempData1 = JSON.stringify(tempData1);
          tempData2 = JSON.stringify(tempData2);

          [err] = await to(client_hmset(`user:${userName}`,
            'unreadMessages', tempData1,
            'unreadMessagesAmountData', tempData2
          ));
        })
        .catch(({ err, fn }) => {
          console.log(err);
          fn(err);
          socket.disconnect(true);
        });

      //测试用
      socket_on('server_test')
        .then(async (data, fn) => {
          console.log('开始');
          fn('mylove');
        })
    }
  })
  .catch(err => {
    console.log(err);
  });


// //配置个人中间件
// app.use((req, res, next) => {

//   next();
// })

app_get('/')
  .then((req, res, next) => {
    let
      options = {
        root: __dirname + '/web/dist/',
        dotfiles: 'deny',
        headers: {
          'x-timestamp': Date.now(),
          'x-sent': true
        }
      },
      res_senFile = promisify(res.sendFile, res);

    res_sendFile('index', options)
      .catch(err => next(err));
  })
  .catch(err => console.log(err));

//检测是否已经登录
app_get('/api/login')
  .then((req, res, next) => {
    console.log(req);
    if (!req.session.userName) {
      res.send(JSON.stringify({ code: 0 }));
    } else {
      res.send(JSON.stringify({ code: 1, userName: req.session.userName }));
    }
  })
  .catch(err => console.log(err));

//登录
app_post('/api/login')
  .then(async (req, res, next) => {
    let
      err, user;
    if (req.body.userName && req.body.password && !req.session.userName) {
      [err, user] = await to(client_hgetall(`user:${req.body.userName}`));
      if (err) next(err);
      else if (user) {
        if (req.body.password === user.password) {
          req.session.userName = req.body.userName;
          res.send(JSON.stringify({
            code: 1,
            userName: user.userName,
            userData: {
              email: user.email,
              friends: user.friends,
              avatar: user.avatar,
              customSettings: user.customSettings
            }
          }));
        } else {
          res.send(JSON.stringify({ code: 2 }));
        }
      }
    }
  })
  //只有未知错误才会被送到这里
  .catch(err => console.log(err));

//注销
app_get('/api/logout')
  .then((req, res, next) => {
    if (req.session.userName) {
      req.session.userName = '';
      res.send(JSON.stringify({ code: 1 }));
    } else {
      res.send(JSON.stringify({ code: 0 }));
    }
  })
  .catch(err => console.log(err));

//先注册，再验证邮箱
app_post('/api/register')
  .then(async (req, res, next) => {
    let
      userName = req.body.userName,
      password1 = req.body.password1,
      password2 = req.body.password2,
      email = req.body.email,
      avatar = req.body.avatar,
      customSettings = req.body.customSettings,
      verifyCode, err, result;

    if (!userName || !password1 || !password2 || password1 !== password2 || !passwordReg.test(password1)) {
      res.send(JSON.stringify({ code: 3 }));
    } else if (!emailReg.test(email)) {
      res.send(JSON.stringify({ code: 8 }))
    } else {
      [err, result] = to(client_hgetall(`user:${userName}`));

      if (err) next(err);
      else if (result) {
        res.send(JSON.stringify({ code: 4 }));
      } else {
        //服务器端暂存userName
        req.session.tempUserName = userName;
        //发送邮件
        verifyCode = createVerifyCode();
        sendEmail(email, verifyCode);
        //这里不判断userNotVerify:userName的key是否存在了，直接删去
        await client.del(`userNotVerify:${req.body.userName}`);

        [err] = await to(client_hmset(`userNotVerify:${req.body.userName}`,
          'userName', userName,
          'password', password1,
          'email', email,
          'friends', '[]',
          'avatar', avatar,
          'customSettings', customSettings,
          'verifyCode', verifyCode,
          'groups', '[]',
          'unreadMessages', '[]',
          'unreadMessagesAmountData', '{}'));

        if (err) next(err);
        else {
          //到这里即成功
          res.send(JSON.stringify({ code: 1 }));
        }
      }
    }
  })
  .catch(err => console.log(err));

//这里验证邮箱
app_post('/api/verifyEmail')
  .then(async (req, res, next) => {
    let err, userName;
    if (!req.body.verifyCode || !req.session.tempUserName || !verifyCodeReg.test(req.body.verifyCode)) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      [err, user] = to(client_hgetall(`userNotVerify:${req.session.tempUserName}`));
      if (err) next(err);
      else if (user) {
        //排除非法的直接向该api注册已有账号
        [err, userName] = to(client_hget(`user:${req.session.tempUserName}`, 'userName'));

        if (err) next(err);
        else if (userName) {
          res.send(JSON.stringify({ code: 4 }));
        } else if (req.body.verifyCode === user.verifyCode) {
          //到这里即已经验证通过
          client.del(`userNotVerify:${req.session.tempUserName}`);

          [err] = await to(client_hmset(`user:${req.session.tempUserName}`,
            'userName', user.userName,
            'password', user.password,
            'email', user.email,
            'friends', user.friends,
            'avatar', user.avatar,
            'customSettings', user.customSettings,
            'unreadMessages', user.unreadMessages,
            'unreadMessagesAmountData', user.unreadMessagesAmountData
          ))

          if (err) next(err);
          else {
            res.send(JSON.stringify({ code: 1 }));
          }
          //清空req.session.tempName
          req.session.tempName = '';
        }
      }
    }
  })
  .catch(err => console.log(err));

app_get('/api/blog')
  .then(async (req, res, next) => {
    let
      err, result;
    if (!req.session.userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else {
      [err, result] = await to(client_hgetall('blog:temp'));
      if (err) {
        next(err);
      } else if (result) {
        res.send(JSON.stringify({ blogs: result, code: 1 }));
      } else {
        res.send(JSON.stringify({ code: 7 }));
      }
    }
  })
  .catch(err => console.log(err));

app_post('/api/blog')
  .then(async (req, res, next) => {
    let
      title = req.body.title,
      content = req.body.content,
      date = Date.now(),
      author = req.body.author,
      err, id;

    if (!req.session.userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!title || !content) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      [err, id] = await to(client_incr('blog:ids'));

      if (!err && id) {
        [err] = await to(client_hmset(`blog:${id}`,
          'id', id,
          'title', title,
          'content', content,
          'userName', req.session.userName,
          'author', author,
          'date', date,
          'lastEditTime', date));

        if (err) {
          next(err);
        } else {
          [err] = to(client_hset('blog:temp',
            id,
            JSON.stringify({
              id,
              title,
              content,
              author,
              date,
              userName: req.session.userName,
              lastEditTime: date
            })
          ));

          if (err) {
            next(err);
          } else {
            res.send(JSON.stringify({ code: 1 }));
          }
        }
      } else if (!err) {
        res.send(JSON.stringify({ code: 7 }));
      } else {
        next(err);
      }
    }
  })
  .catch(err => console.log(err));

//获取博客
app_get('/api/blog/:id')
  .then(async (req, res, next) => {
    let
      id = req.params.id,
      db_result, err, result;

    if (!req.session.userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else {
      [err, result] = await to(client_hgetall(`blog:${id}`));

      if (err) {
        next(err);
      } else if (result) {
        res.send(JSON.stringify({ blog: result, code: 1 }));
      } else {
        res.send(JSON.stringify({ code: 7 }));
      }
    }
  })
  .catch(err => console.log(err));

app_put('/api/blog')
  .then(async (req, res, next) => {
    let
      title = req.body.title,
      content = req.body.content,
      date = Date.now(),
      author = req.body.author,
      id = req.body.id,
      err, lastEditTime;

    if (!req.session.userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!title || !content) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      [err, lastEditTime] = to(client_hget(`blog:${id}`, 'date'));

      if (err) next(err);

      else if (lastEditTime) {
        [err] = await to(client_hmset(`blog:${id}`,
          'id', id,
          'title', title,
          'content', content,
          'userName', req.session.userName,
          'author', author,
          'date', date,
          'lastEditTime', lastEditTime
        ));
        if (err) next(err);

        else {
          [err] = await to(client_hset('blog:temp',
            id,
            JSON.stringify({
              id,
              title,
              content,
              author,
              date,
              lastEditTime,
              userName: req.session.userName
            })
          ));
          if (err) next(err);
          else {
            res.send(JSON.stringify({ code: 1 }));
          }
        }
      } else if (!err) {
        res.send(JSON.stringify({ code: 7 }));
      } else {
        next(err);
      }
    }
  })
  .catch(err => console.log(err));

//删除好友
app_delete('/api/blog/:id')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      id = req.params.id;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else {
      //到这里验证成功,没必要验证id是否存在，正常操作id肯定存在，非正常操作也无影响
      [err] = await to(client_del(`blog:${id}`));
      if (err) next(err);
      else {
        res.send(JSON.stringify({ code: 1 }));
      }
    }
  })

//添加好友
app_post('/api/friends')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      friendUserName = req.body.friendUserName,
      firendArray, name;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!friendUserName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      [err, friendArray] = await to(client_hget(`user:${userName}`, 'friends'))
        .then(([err, friendArray]) => [err, JSON.parse(friendsArray)]);
      if (err) next(err);
      else {
        [err, name] = await to(client_hget(`user:${friendUserName}`, 'userName'));
        if (err) next(err);
        //即好友存在
        else if (name) {
          //到这里验证完成
          friendsArray.push({
            userName: friendUserName,
            order: friendsArray.length + 1,
            addDate: (new Data()).valueOf()
          });

          [err] = await to(client_hset(`user:${userName}`,
            'friends',
            JSON.stringify(friendsArray)
          ));
          if (err) next(err)
          else {
            res.send(JSON.stringify({ code: 1 }));
          }
        }
      }
    }
  })
  .catch(err => console.log(err));


app_post('/api/group')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      groupName = req.body.groupName,
      groupData = req.body.groupData,
      group;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!groupName || !groupData) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      [err, group] = await to(client_hget(`group:${groupName}`))
      if (err) next(err);
      else {
        if (group) {
          res.send(JSON.stringify({ code: 4 }));
        } else {
          //到这里验证成功
          [err] = to(client_hmset(`group:${groupName}`,
            'groupMembers', `[${userName}]`,
            'groupData', groupData,
            'groupMessages', '[]',
            'groupMembersUnreadMessagesAmountData', `{${userName}:0}`));
          if (err) next(err);
          else {
            res.send({ code: 1 });
          }
        }
      }
    }
  })
  .catch(err => console.log(err));

//删除组
app_delete('/api/group')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      groupName = req.body.userName,
      err;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!groupName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      [err] = await to(client_del(`user:${groupName}`));
      if (err) {
        next(err);
      } else {
        res.send(JSON.stringify({ code: 1 }));
      }
    }
  })
  .catch(err => console.log(err));

app_post('/api/addGroupMembers')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      groupName = req.body.userName,
      newMemberName = req.body.newMemberName,
      err, groups, groupMembers;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!groupName || !newMemberName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      [err, groupMembers] = await to(client_hget(`group:${groupName}`, 'groupMembers'))
        .then(([err, groupMembers]) => [err, JSON.parse(groupMembers)]);
      if (err) next(err);
      else if (groupMembers) {
        if (newMemberName in groupMembers) {
          res.send(JSON.stringify({ code: 4 }));
        } else {
          [err, groups] = await to(client_hget(`user:${newMemberName}`, 'groups'))
            .then(([err, groups]) => [err, JSON.parse(groups)]);
          if (err) {
            next(err);
          } else if (groups) {
            //到这里验证结束
            groupMembers = groupMembers.push(newMemberName);
            gourps = groups.push(newMemberName);
            [err] = await to(client_hset(`group:${groupName}`, 'groupMembers', JSON.stringify(groupMembers)));
            if (err) next(err);
            else {
              [err] = await to(client_hset(`user:${newMemberName}`, 'groups', JSON.stringify(groups)));
              if (err) next(err);
              else {
                res.send(JSON.stringify({ code: 1 }));
              }
            }
          }
        }

      } else {
        res.send(JSON.stringify({ code: 7 }));
      }
    }
  })
  .catch(err => console.log(err));

//删除好友
app_delete('/api/friends')
  .then(async (req, res, next) => {
    let
      userName = req.session.userName,
      friendUserName = req.body.userName;
    if (!userName) {
      res.send(JSON.stringify({ code: 5 }));
    } else if (!friendUserName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      [err] = await to(client_del(`user:${friendUserName}`));
      if (err) next(err);
      else {
        res.send(JSON.stringify({ code: 1 }));
      }
    }
  })
  .catch(err => console.log(err));

//访问不存在的路由的时候返回首页
app_get('*')
  .then((req, res, next) => {
    res.redirect('/');
  })
  .catch(err => console.log(err));

server.listen(80);

console.log('server start.');