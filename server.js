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
  createVerifyCode = require('./util').createVerifyCode;

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
  passwordReg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;

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
client.on('error', (err) => {
  console.log('Error:' + err);
})

//使用session中间件
app.use(sessionMiddleware);
io.use(function(socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

//配置基础中间件
app.use(express.static(path.join(__dirname, './web/dist')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//使用socket.io
io.on('connection', (socket) => {
  if (socket.request.session.userName) {
    let
      userName = socket.request.session.userName,
      id = socket.id;
    //一旦客户端连入，则保存其id
    client.hmset('onlineUser',
      userName, JSON.stringify({ id }),
      (err) => {
        if (err) {
          throw err;
        }
      }
    );

    //这是开始就要做的一步,上线就加入所有组的room
    socket.on('client_joinGroupsRooms', ({ groups }) => {
      if (Object.prototype.toString.call(groups) === '[object Array]') {;
        socket.join(groups, (err) => {
          if (err) {
            typeof err;
          }
        });
      }
    });

    //断开连接
    socket.on('disconnect', () => {
      client.hdel('onlineUser',
        userName,
        (err) => {
          if (err) {
            throw err;
          }
        });
    });

    //告诉客户端有多少消息未读,主要是方便客户端把io.on可以都放在回调函数里，如果立刻发送，客户端对应的on处理程序可能没加载好
    socket.on('server_sendMessagesAmount', ({ groupBool, groupName }) => {
      if (!groupBool) {
        client.hget(`user:${userName}`, 'unreadMessagesAmountData', (err, unreadMessagesAmountData) => {
          if (err) {
            throw err;
          } else if (unreadMessagesAmountData) {
            socket.emit('client_receiveMessagesAmount', { unreadMessagesAmountData })
          } else {
            socket.disconnect(true);
          }
        });
      } else if (groupBool && groupName) {
        //所有未读的人能一次查清，但是组只能一个一个查
        client.hget(`group:${userName}`, 'groupMembersUnreadMessagesAmountData', (err, groupMembersUnreadMessagesAmountData) => {
          if (err) {
            throw err;
          } else if (groupMembersUnreadMessagesAmountData) {
            groupMembersUnreadMessagesAmountData = JSON.parse(groupMembersUnreadMessagesAmountData);
            socket.emit('client_receiveMessagesAmount', { groupBool: true, groupName, amount: groupMembersUnreadMessagesAmountData[userName] })
          } else {
            socket.disconnect(true);
          }
        });
      }
    })


    //这里处理客户端发送消息,并记录未读消息数量
    socket.on('server_handleMessageFromClient', (message) => {
      let
        userName = message.to,
        fromWho = message.from,
        groupBool = message.groupBool,
        groupName = message.groupName;
      if (!userName || !fromWho) {
        socket.disconnect(true);
      } else if (!groupBool) {
        client.hgetall(`user:${userName}`, 'unreadMessages', (err, { unreadMessages, unreadMessagesAmountData }) => {
          if (err) {
            typeof err;
          }
          //这里如果为真,则确定不是非法请求
          if (unreadMessages) {
            //在这里先处理下unreadMessages和unreadMessageAmountData
            unreadMessages = JSON.parse(unreadMessages).push(message);
            unreadMessagesAmountData = JSON.parse(unreadMessagesAmountData);
            if (fromWho in unreadMessagesAmountData) {
              unreadMessagesAmountData[fromWho] = ++Number(unreadMessagesAmountData[fromWho]);
            } else {
              unreadMessagesAmountData[fromWho] = 1;
            }

            //记录完数字后stringify化
            unreadMessages = JSON.stringify(unreadMessages);
            unreadMessagesAmountData = JSON.stringify(unreadMessagesAmountData);

            //先将消息存入未读序列
            client.hmset(`user:${userName}`,
              'unreadMessages',
              unreadMessages,
              'unreadMessagesAmountData',
              unreadMessagesAmountData,
              (err, res) => {
                if (err) {
                  typeof err;
                }
              }
            );

            //现在开始确认用户是否在线
            client.hget('onlineUser', userName, (err, { id }) => {
              if (err) {
                typeof err;
              }
              if (id) {
                //只有当该客户端在线,告诉该客户端共有几条未读消息
                socket.to(id).emit('client_receiveMessagesAmount', { unreadMessagesAmountData })
              }
            });

          } else {
            socket.disconnect(true);
          }
        })
      } else if (groupBool && groupName) {
        client.hget(`group:${groupName}`, 'groupMessages', 'groupMembersUnreadMessagesAmountData', (err, result) => {
          if (err) {
            throw err;
          }
          if (result) {
            let
              groupMessages = JSON.parse(result.groupMessages).push(message),
              groupMembersUnreadMessagesAmountData = JSON.parse(result.groupMembersUnreadMessagesAmountData);
            for (let user in groupMembersUnreadMessagesAmountData) {
              if (groupMembersUnreadMessagesAmountData.hasOwnProperty(user)) {
                //最多500条
                if (Number(groupMembersUnreadMessagesAmountData[user]) <= 499) {
                  groupMembersUnreadMessagesAmountData[user] = ++Number(groupMembersUnreadMessagesAmountData[user]);
                } else {
                  groupMembersUnreadMessagesAmountData[user] = 500;
                }
              }
            }

            //操作完后stringify化
            groupMessages = JSON.stringify(groupMessages);
            groupMembersUnreadMessagesAmountData = JSON.stringify(groupMembersUnreadMessagesAmountData);

            client.hset(`group:${groupName}`, 'groupMessages', groupMessages, 'groupMembersUnreadMessagesAmountData', groupMembersUnreadMessagesAmountData, (err) => {
              if (err) {
                throw err;
              }
              //如果是组，则不发送消息具体数量，让在线的客户端自己去取
              socket.to(groupName).emit('client_receiveMessagesAmount', { groupBool: true, groupName });
            })

          } else {
            socket.disconnect(true);
          }
        });
      }
    });

    //这里发送所有未读完的消息,并清除未读消息数量
    socket.on('server_sendMessage', ({ friendUserName, groupName }) => {
      if (friendUserName) {
        client.hget(`user:${friendUserName}`, 'unreadMessages', (err, unreadMessages) => {
          if (err) {
            typeof err;
          } else if (unreadMessages) {
            socket.emit('client_receiveMessages', JSON.parse(unreadMessages));
            //发送后即清空未读消息
            client.hset(`user:${userName}`,
              'unreadMessages',
              '[]',
              'unreadMessagesAmountData',
              '{}',
              (err) => {
                if (err) {
                  typeof err;
                }
              }
            )
          } else {
            socket.disconnect(true)
          }
        });
      } else if (groupName) {
        client.hgetall(`group:${groupName}`, (err, { groupMessages, groupMembersUnreadMessagesAmountData }) => {
          if (err) {
            throw err;
          } else if (groupMessages) {
            let
              groupMessages = JSON.parse(groupMessages);

            socket.emit('client_receiveMessages', { groupBool: true, groupName, groupMessages });

            //将该用户的未读消息改为0
            groupMembersUnreadMessagesAmountData = JSON.parse(groupMembersUnreadMessagesAmountData);
            groupMembersUnreadMessagesAmountData[userName] = 0;

            if (groupMessages.length > 1000) {
              //当超过1000条消息，只保留后500条
              groupMessages = JSON.stringify(groupMessages.slice(-500));
            }

            client.hset(`group:${groupName}`,
              'unreadMessages',
              groupMessages,
              'groupMembersUnreadMessagesAmountData',
              groupMembersUnreadMessagesAmountData,
              (err) => {
                if (err) {
                  throw err;
                }
              }
            )
          } else {
            socket.disconnect(true);
          }
        });
      } else {
        socket.disconnet(true);
      }
    });

    socket.on('test', (data) => {
      console.log(data);
    })
  };

});

// //配置个人中间件
// app.use((req, res, next) => {

//   next();
// })

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
        'friends', 'no friends',
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
      client.hset(`group:${groupName}`, 'groupMembers',(err, result) => {
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
                  res.send(JSON.stringify({code: 1}));
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