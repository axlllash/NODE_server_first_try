const
  path = require('path'),
  express = require('express'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  redis = require('redis'),
  fs = require('fs'),
  morgan = require('morgan'),
  //配置
  client = redis.createClient({ password: '123456ww' }),
  redisStore = require('connect-redis')(session),
  app = express(),
  // 自己的模块
  sendEmail = require('./email'),
  log = require('./config/log'),
  createVerifyCode = require('./util').createVerifyCode;

//一些全局参数
sessionOptions = {
  ciient: client,
  port: 6379,
  host: '127.0.0.1',
  logErrors: true,
  db: 2,
  pass: '123456ww'
};

//用于redis提示错误信息
client.on('error', function(err) {
  console.log('Error:' + err);
})

app.use(session({
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
}));

//配置基础中间件
app.use(express.static(path.join(__dirname, 'static')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//配置个人中间件
app.use((req, res, next) => {
  console.log('请求url' + req.originalUrl);
  console.log(req.body);
  next();
})

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

app.get('/', (req, res) => {
  let
    options = {
      root: __dirname + '/static/',
      dotfiles: 'deny',
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
      }
    };

  res.sendFile('index', options, function() {
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
          userName: user.userName
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
app.get('/api/register', (req, res, next) => {
  let
    userName = req.body.userName,
    password1 = req.body.password1,
    password2 = req.body.password2,
    email = req.body.email,
    myreg = /^([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/,
    verifyCode;

  if (!userName || !password1 || !password2 || password1 !== password2) {
    res.send(JSON.stringify({ code: 3 }));
  }
  if (!myreg.test(email)) {
    res.send(JSON.stringify({ code: 8 }))
  }

  client.hget(`user:${userName}`, 'userName', (err, userName) => {
    if (err) {
      next(err);
    }
    if (userName) {
      res.send(JSON.stringify({ code: 4 }));
    } else {
      //发送邮件
      verifyCode = createVerifyCode();
      sendEmail(email, verifyCode);
      //这里不判断userNotVerify:userName的key是否存在了，直接删去
      client.del(`userNotVerify:${req.body.userName}`);

      client.hmset(`userNotVerify:${req.body.userName}`,
        'userName', userName,
        'password', password1,
        'email', req.body.email,
        'friends', '',
        'avatar', '',
        'customSettings', '',
        'verifyCode', verifyCode(err) => {
          if (!err) {
            res.send(JSON.stringify({ code: 1 }));
          }
          throw err;
        }
      );
    }
  });
});

//注册（但这里要多加一个验证邮箱的api）
app.post('/api/verifyEmail', (req, res, next) => {
  if (!req.body.verifyCode || !req.body.userName) {
    res.send(JSON.stringify({ code: 3 }));
  }

  client.hgetall(`userNotVerify:${req.body.userName}`, (err, user) => {
    if (err) {
      next(err);
    } else {
      //排除非法的直接向该api注册已有账号
      client.hget(`user:${req.body.userName}`, 'userName', (err, userName) => {
        if (err) {
          next(err);
        } else if (userName) {
          res.send(JSON.string({ code: 4 }));
        } else if (req.body.verifyCode === verifyCode) {
          //到这里即已经验证通过
          client.del(`userNotVerify:${req.body.userName}`);

          client.hmset(`user:${req.body.userName}`,
            'userName', user.userName,
            'password', user.password,
            'email', user.email,
            'friends', user.frineds,
            'avatar', user.avatar,
            'customSettings', user.customSettings,
            (err) => {
              if (!err) {
                res.send(JSON.stringify({
                  code: 1,
                  userName: user.userName
                  userData: {
                    email: user.email,
                    friends: user.friends,
                    avatar: user.avatar,
                    customSettings: user.customSettings
                  }
                }));
              } else {
                next(err);
              }
            }
          );
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
          'lastEditTime', date(err) => {
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
    author = req.body.author;

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
    } else if (err) {
      next(err);
    })
  }
});

//删除好友
app.del('/api/blog/:id', (req, res, next) => {
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
})

//删除好友
app.del('/api/friends', (req, res, next) => {
  let
    userName = req.session.userName,
    friendUsername = req.body.userName;
  if (!userName) {
    res.send(JSON.stringify({ code: 5 }));
  } else {
    if (!friendUsername) {
      res.send(JSON.stringify({ code: 3 }));
    } else {
      //到这里验证成功
      client.del(`user:${friendUsername}`, (err) => {
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
app.listen(80);