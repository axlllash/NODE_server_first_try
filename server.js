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
  client_on = promisify(client.on, client),
  client_hget = promisify(client.hget, client),
  client_hgetall = promisify(client.hgetall, client),
  client_hset = promisify(client.hset, client),
  client_hmset = promisify(client.hmset, client),
  client_hdel = promisify(client.hdel, client),
  client_exists = promisify(client.exists, client),
  io_on = promisify(io.on, io);


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
app_all('*')
  .then(asymc(req, res, next) => {
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
  })
  .catch(err => {
    throw err;
  })


//使用socket.io
io_on('connection')
  .then(async (socket) => {
    if (socket.request.session.userName) {
      const
        //将socket的几个方法promisify化
        socket_once = promiseify(sokcet.once, socket, false),
        socket_on = promisify(socket.on, socket, false),
        socket_join = promiseify(socket_join, socket, false),
        sokcet_emit = promiseify(socket_emit, socket, false);
      let
        userName = socket.request.session.userName,
        id = socket.id,
        err;
      //一旦客户端连入，则保存其ID,以后还可能保存其他的数据
      [err] = await to(client_hset('onlineUser', userName, JOSN.stringify({ id })));
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

      //上线即让用户所有组加入room，这里只监听，因此不用await
      socket_on('server_joinGroupsRooms')
        .then(async ({ groups }, fn) => {
          if (isType(groups) === 'Array' && groups.length > 0) {
            [err] = await to(socket_join(groups));
            if (err) throw err;
            //客户端传来的回调函数，便于客户端使用await
            fn({ code: 1 });
          }
        })
        .catch(err => {
          console.log(err);
          socket.disconnect(true);
        });

      //对于客户端初始化的时候，发送所有群消息，后续所有群消息则由服务器端自动发送
      //而普通好友消息，并不需要发送具体消息，只需要一个驱动，发送自上次登录以来所有未读消息
      //然后客户端自动去申请消息
      socket_once('initFriendsMessagesAndGroupsMessages')
        .then(async (groups, fn) => {
          let
            unreadMessagesAmountData,
            groupMessages;
          if (isType(groups) !== 'Array') throw 'invalid operation.';
          //unreadMessagesAmountData是必定存在的，因此不用验证
          [err, unreadMessagesAmountData] = await to(client_hget(`user:${userName}`, 'unreadMessagesAmountData'));
          if (err) throw err;
          groups.foreach((groupName) => {
            [err, groupMessages[groupName]] = await client_hget(`group:${groupName}`, 'groupMessages');
            if (err) throw err;
            else if (isType(JSON.parse(groupMessages[groupName]))) throw 'invalid operation.';
          });
          //发回数据给客户端
          fn({ unreadMessagesAmountData, groupMessages });
        })
        .catch(err => {
          console.log(err);
          socket.disconnect(true);
        })

      //发送好友的未读消息数量，之所以让所有消息都先存为未读，这样可以确保用户确实读到了消息，
      //而非发到客户端就算读过
      socket_on('server_sendMessagesAmount')
        .then(async (fn) => {
          let
            unreadMessagesAmountData;
          [err, unreadMessagesAmountData] = await to(client_get(`user:${userName}`, 'unreadMessagesAmountData'));
          if (err) throw err;
          //直接发送未读数据，以供客户端回调函数使用
          fn({ unreadMessagesAmountData });
        })
        .catch(err => {
          console.log(err);
          socket.disconnect(true);
        });

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
            toWhoId;
          if (!toWho || !fromWho) throw 'incomplete information.'
          if (!groupBool) {
            [err, data] = await to(client_hgetall(`user:${toWho}`))；
            if (err) throw err;
            if (!data) throw 'invalid operation.';
            //此时可以去除掉toWho字段了
            delete message.to;
            unreadMessages = JSON.parse(data.unreadMessages)[fromWho].push(message);
            unreadMessagesAmountData = JSON.parse(data.unreadMessagesAmountData);
            //记录未读消息数量
            unreadMessagesAmountData[fromWho] = unreadMessages[fromWho].length;
            //统一stringify化
            unreadMessages = JSON.stringify(unreadMessages);
            unreadMessagesAmountData = JSON.stringify(unreadMessagesAmountData);
            //然后开始存入redis
            [err] = await to(client_hmset(`user:${userName}`,
              'unreadMessages', unreadMessages,
              'unreadMessagesAmountData', unreadMessagesAmountData));
            if (err) throw err;

            //现在开始确认接受方是否在线
            [err, { toWhoId }] = await to(client_hget('onlineUser', toWho));
            if (err) throw err;
            if (toWhoId) socket.to(id).emit('client_receiveMessagesAmount', { unreadMessagesAmountData });
            //成功，给客户端的回调
            fn({ code: 1 });
            //如果有这两字段，说明发的是群消息
          } else if (groupBool && groupName) {
            let
              groupMessages;

            [err, groupMessages] = to(client_hget(`group:${groupName}`, 'groupMessages'));
            if (err) throw err;

            if (groupMessaages) {
              //说明该群存在，则直接发送最新的消息给最新的用户
              socket.to(groupName).emit('client_receiveMessagesFromGroup', message);
              //去除两个无关的key
              delete message.groupBool;
              delete message.groupName;
              //存进现有消息里
              groupMessaages = JSON.parse(groupMessages).push(message);

              //这里判断一下群消息长度，若超过1000，只存储500条消息
              if (groupMessages.length > 1000) groupMessages = groupMessages.slice(-500);

              //开始为不在线的用户存储群消息
              [err] = await to(client_hset(`group:${groupName}`, 'groupMessages', groupMessages));

              if (err) throw err;
              //操作成功
              fn({ code: 1 });
            } else {
              throw 'invalid operation.'
            }
          }
        })
        .catch(err => {
          console.log(err);
          socket.disconnect(true);
        });

      //发送消息，响应客户端的emit，但是用不着发组消息，只针对来自朋友的消息
      socket_on('server_sendMessage')
        .then(async (fn) => {
          let
            unreadMessages;
          [err, unreadMessages] = await to(client_hget(`user:${userName}`, 'unreadMessages'));
          if (err) throw err;
          //unreadMessage必定存在，但是否为空不得而知
          fn({ unreadMessages });
        })
        .catch((err) => {
          console.log(err);
        });
    }
  })
  .catch(err => {
    console.log(err);
  });


// //配置个人中间件
// app.use((req, res, next) => {

//   next();
// })


app.get('/', (req, res, next) => {
  let
    options = {
      root: __dirname + '/web/dist/',
      dotfiles: 'deny',
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
      }
    };

  res.sendFile('index', options, function(err) {
    if (err) {
      next(err);
    }
  })
});

//检测是否已经登录
app.get('/api/login', (req, res, next) => {
  if (!req.session.userName) {
    res.send(JSON.stringify({ code: 0 }));
  } else {
    res.send(JSON.stringify({ code: 1, userName: req.session.userName }));
  }
});

//登录
app.post('/api/login', (req, res, next) => {
  if (req.body.userName && req.body.password && !req.session.userName) {
    client.hgetall(`user:${req.body.userName}`, function(err, user) {
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
    })
  }
});

//注销
app.get('/api/logout', (req, res, next) => {
  if (req.session.userName) {
    req.session.userName = '';
    res.send(JSON.stringify({ code: 1 }));
  } else {
    res.send(JSON.stringify({ code: 0 }));
  }
});

//先注册，再验证邮箱
app.post('/api/register', (req, res, next) => {
  let
    userName = req.body.userName,
    password1 = req.body.password1,
    password2 = req.body.password2,
    email = req.body.email,
    avatar = req.body.avatar,
    customSettings = req.body.customSettings,
    verifyCode;

  console.log(req.body);

  if (!userName || !password1 || !password2 || password1 !== password2 || !passwordReg.test(password1)) {
    res.send(JSON.stringify({ code: 3 }));
  }
  if (!emailReg.test(email)) {
    res.send(JSON.stringify({ code: 8 }))
  }

  client.hgetall(`user:${userName}`, (err, result) => {
    if (err) {
      next(err);
    }
    if (result) {
      res.send(JSON.stringify({ code: 4 }));
    } else {
      //服务器端暂存userName
      req.session.tempUserName = userName;
      //发送邮件
      verifyCode = createVerifyCode();
      sendEmail(email, verifyCode);
      //这里不判断userNotVerify:userName的key是否存在了，直接删去
      client.del(`userNotVerify:${req.body.userName}`);

      client.hmset(`userNotVerify:${req.body.userName}`,
        'userName', userName,
        'password', password1,
        'email', email,
        'friends', '[]',
        'avatar', avatar,
        'customSettings', customSettings,
        'verifyCode', verifyCode,
        'unreadMessages', '[]',
        'unreadMessagesAmountData', '{}',
        (err) => {
          if (err) {
            next(err);
          }
          res.send(JSON.stringify({ code: 1 }));
        }
      );
    }
  });
});

//这里验证邮箱
app.post('/api/verifyEmail', (req, res, next) => {
  if (!req.body.verifyCode || !req.session.tempUserName || !verifyCodeReg.test(req.body.verifyCode)) {
    res.send(JSON.stringify({ code: 3 }));
  }

  client.hgetall(`userNotVerify:${req.session.tempUserName}`, (err, user) => {
    console.log(user);
    if (err) {
      next(err);
    } else {
      //排除非法的直接向该api注册已有账号
      client.hget(`user:${req.session.tempUserName}`, 'userName', (err, userName) => {
        if (err) {
          next(err);
        } else if (userName) {
          res.send(JSON.stringify({ code: 4 }));
        } else if (req.body.verifyCode === user.verifyCode) {
          //到这里即已经验证通过
          client.del(`userNotVerify:${req.session.tempUserName}`);

          client.hmset(`user:${req.session.tempUserName}`,
            'userName', user.userName,
            'password', user.password,
            'email', user.email,
            'friends', user.frineds,
            'avatar', user.avatar,
            'customSettings', user.customSettings,
            'unreadMessages', user.unreadMessages,
            'unreadMessagesAmountData', user.unreadMessagesAmountData,
            (err) => {
              if (!err) {
                res.send(JSON.stringify({ code: 1 }));
              } else {
                next(err);
              }
            }
          );

          //清空req.session.tempName
          req.session.tempName = '';
        }
      })
    }
  });
});

app.get('/api/blog', (req, res, next) => {
  if (!req.session.userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    client.hgetall('blog:temp', (err, result) => {
      if (err) {
        next(err);
      }
      if (result) {
        res.send(JSON.stringify({ blogs: result, code: 1 }));
      } else {
        res.send(JSON.stringify({ code: 7 }));
      }
    });
  }
});

app.post('/api/blog', (req, res, next) => {
  let
    title = req.body.title,
    content = req.body.content,
    date = Date.now(),
    author = req.body.author;

  if (!req.session.userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else if (!title || !content) {
    res.send(JSON.stringify({ code: 3 }));
  } else {
    client.incr('blog:ids', (err, id) => {
      if (!err && id) {
        client.hmset(`blog:${id}`,
          'id', id,
          'title', title,
          'content', content,
          'userName', req.session.userName,
          'author', author,
          'date', date,
          'lastEditTime', date,
          (err) => {
            if (err) {
              next(err);
            }
          }
        );
        client.hset('blog:temp', id, JSON.stringify({ id, title, content, author, date, userName: req.session.userName, lastEditTime: date }),
          (err) => {
            if (err) {
              next(err);
            }
          }
        );
        res.send(JSON.stringify({ code: 1 }));
      } else if (!err) {
        res.send(JSON.stringify({ code: 7 }));
      } else {
        next(err);
      }
    })
  }
});

//获取博客
app.get('/api/blog/:id', (req, res, next) => {
  let
    id = req.params.id,
    db_result;

  if (!req.session.userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    client.hgetall(`blog:${id}`, (err, result) => {
      if (err) {
        next(err);
      }
      if (result) {
        res.send(JSON.stringify({ blog: result, code: 1 }));
      } else {
        res.send(JSON.stringify({ code: 7 }));
      }
    });
  }
});

app.put('/api/blog', (req, res, next) => {
  let
    title = req.body.title,
    content = req.body.content,
    date = Date.now(),
    author = req.body.author,
    id = req.body.id;

  if (!req.session.userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else if (!title || !content) {
    res.send(JSON.stringify({ code: 3 }));
  } else {
    client.hget(`blog:${id}`, 'date', (err, lastEditTime) => {
      if (lastEditTime) {
        client.hmset(`blog:${id}`,
          'id', id,
          'title', title,
          'content', content,
          'userName', req.session.userName,
          'author', author,
          'date', date,
          'lastEditTime', lastEditTime,
          (err) => {
            if (err) {
              next(err);
            }
          }
        );
        client.hset('blog:temp', id, JSON.stringify({ id, title, content, author, date, lastEditTime, userName: req.session.userName }),
          (err) => {
            if (err) {
              next(err);
            }
          }
        );
        res.send(JSON.stringify({ code: 1 }));
      } else if (!err) {
        res.send(JSON.stringify({ code: 7 }));
      } else {
        next(err);
      }
    });
  }
});

//删除好友
app.delete('/api/blog/:id', (req, res, next) => {
  let
    userName = req.session.userName,
    id = req.params.id;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    //到这里验证成功,没必要验证id是否存在，正常操作id肯定存在，非正常操作也无影响
    client.del(`blog:${id}`, (err) => {
      if (err) {
        next(err);
      } else {
        res.send(JSON.stringify({ code: 1 }));
      }
    });
  }
})

//添加好友
app.post('/api/friends', (req, res, next) => {
  let
    userName = req.session.userName,
    friendUsername = req.body.friendUsername;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else if (!friendUsername) {
    res.send(JSON.stringify({ code: 3 }));
  } else {
    client.hget(`user:${userName}`, 'friends', (err, friendsArray) => {
      if (err) {
        next(err);
      } else {
        client.hget(`user:${friendUsername}`, 'userName', (err, name) => {
          if (err) {
            next(err);
            //即好友存在
          } else if (name) {
            //到这里验证完成
            friendsArray = JSON.parse(friendsArray);
            if (!friendsArray) {
              friendsArray = [];
            }
            friendsArray.push({
              userName: friendUsername,
              order: friendsArray.length + 1,
              addData: (new Data()).valueOf()
            });
            client.hset(`user:${userName}`, 'friends', JSON.stringify(friendsArray), (err) => {
              if (err) {
                next(err)
              } else {
                res.send(JSON.stringify({ code: 1 }));
              }
            })
          }
        })
      }
    })
  }
});

app.post('/api/group', (req, res, next) => {
  let
    userName = req.session.userName,
    groupName = req.body.groupName,
    groupData = req.body.groupData;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    if (!groupName || !groupData) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      client.hget(`group:${groupName}`, (err, gruop) => {
        if (err) {
          next(err);
        } else {
          if (group) {
            res.send(JSON.stringify({ code: 4 }));
          } else {
            //到这里验证成功
            client.hmset(`group:${groupName}`,
              'groupMembers', `[${userName}]`,
              'groupData', groupData,
              'groupMessages', '[]',
              'groupMembersUnreadMessagesAmountData', `{${userName}:0}`,
              (err) => {
                if (err) {
                  next(err);
                } else {
                  res.send(JSON.stringify({ code: 1 }));
                }
              }
            );
          }
        }
      });
    }
  }
});

//删除组
app.delete('/api/group', (req, res, next) => {
  let
    userName = req.session.userName,
    groupName = req.body.userName;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    if (!groupName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      client.del(`user:${groupName}`, (err) => {
        if (err) {
          next(err);
        } else {
          res.send(JSON.stringify({ code: 1 }));
        }
      });
    }
  }
});

app.post('/api/addGroupMembers', (req, res, next) => {
  let
    userName = req.session.userName,
    groupName = req.body.userName,
    newMemberName = req.body.newMemberName;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    if (!groupName || !newMemberName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      client.hset(`group:${groupName}`, 'groupMembers', (err, result) => {
        if (err) {
          next(err);
        }

        if (result) {
          let
            groupMembers = JSON.parse(result);
          if (newMemberName in groupMembers) {
            res.send(JSON.stringify({ code: 4 }));
          } else {
            client.hgetall(`user:${newMemberName}`, (err, result) => {
              if (err) {
                next(err);
              }

              if (result) {
                //到这里验证结束
                groupMembers = groupMembers.push(newMemberName);
                client.hset(`group:${groupName}`, 'groupMembers', JSON.stringify(groupMembers), (err) => {
                  if (err) {
                    next(err);
                  }
                  res.send(JSON.stringify({ code: 1 }));
                });
              }
            });
          }

        } else {
          res.send(JSON.stringify({ code: 7 }));
        }
      });
    }
  }
})


//删除好友
app.delete('/api/friends', (req, res, next) => {
  let
    userName = req.session.userName,
    friendUserName = req.body.userName;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    if (!friendUserName) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      client.del(`user:${friendUserName}`, (err) => {
        if (err) {
          next(err);
        } else {
          res.send(JSON.stringify({ code: 1 }));
        }
      });
    }
  }
})

//访问不存在的路由的时候返回首页
app.get('*', (req, res, next) => {
  res.redirect('/');
});

server.listen(80);

console.log('server start.');