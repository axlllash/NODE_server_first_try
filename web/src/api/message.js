let
  //users是以userName为key，groups是以groupName为键
   _messages={
    users:{},
    groups:{},
   },
   storeMessagesBool=false;

export const initMessages=(args)=>{
  let
    userName=args.userName,
    //这里的friends只指由姓名组成的数组，而非对象的集合，groups同理
    friends=args.friends,
    groups=args.groups,
    localData;

  //这里1的缓存是指本地缓存
  if(storeMessagesBool){
    //则先从缓存中加载数据
    //这里默认一个事实，服务器上发来的新数据，时间一定比本地的新
    //群消息通过服务器完成缓存
    localData=localStorage.getItem(usrName);
    if(localData){
      _messages[users]=JSON.parse(localData);
    }
  }

  //然后再根据传入的friends数组，更新数据
  friends.foreach((i)=>{
    if(!(friends[i] in _messages[users])){
      //建立新的数组以存放消息
      _messages[users][friends[i]=[];
    }
  });

}

export const toggleMessagesBool=(bool)->{
  if(typeof bool==='boolean'){
    storeMessagesBool=bool;
  }else{ 
    throw 'not a bool!';
  }
}