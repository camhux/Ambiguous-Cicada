// Basic Server Requirements
var config = require('./config.js');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var db = require('./db.js')

var port = require('./config.js').port

var express=require('express')

var app=express()
// express initializes app to be a function handler 
var httpServer = require('http').Server(app);
// app is supplied to http server
var io = require('socket.io')(httpServer);
//config dependencies
var secret = require('./secret.js');

app.use(bodyParser.json());

var sessionMiddleware = session({
  // should make session persist even if server crashes
  store: new MongoStore({ mongooseConnection: db.connection }),
  secret: secret,
  resave: true,
  saveUninitialized: true
})
app.use(sessionMiddleware);

app.use("/", express.static(__dirname + '/../client-web'));
//new internal dependencies
var router = require('./routes.js');

//mount middleware to io request, now we have access to socket.request.session
io.use(function(socket,next){
  sessionMiddleware(socket.request,socket.request.res,next)
})

//***************** Sockets *******************
//listen for connection event for incoming sockets
//store all users that want to find a kwiky
io.on('connection',function(socket){
  // console.log('Socket '+ socket.id +' connected.');
  console.log('connection',socket.request.session)
  var address,username;
  //connect user to address if exists on the session
  if (socket.request.session.user){
    if (socket.request.session.user.address){
      socket.join(socket.request.session.user.address.toString());
    }
  }

  socket.on('joinRoom', function(data){
    username = socket.request.session.user.name;
    //save new address to session
    socket.request.session.user.address = data.address
    socket.request.session.save();

    console.log('joinRoom',socket.request.session)

    address = socket.request.session.user.address;
    //join chat room with the name of the address
    socket.join(address.toString());
    console.log(username,' joined room ', address);
  });

  socket.on('leaveRoom', function(){
    socket.leaveRoom(socket.chatRoom);
    console.log(username,' left the room ',address);
    //remove address property on session
    delete address;
  });

  //if client socket emits send message
  socket.on('sendMessage',function(msgData){
    console.log('chatting',socket.request.session)

    // console.log(socket.username,' sending message to room ',socket.chatRoom,' msg: ',msgData.text)
    //broadcast sends to everyone else, but not to self
    //every other socket in the same chatRoom group recieves a 'message event'
    socket.broadcast.to(address).emit('chatMessage',msgData);
  });

  //completely disconnect
  socket.on('disconnect', function(){
    console.log('Socket '+ socket.id +' disconnected.');
    socket.disconnect();
  });
})

// Mount router for api
app.use('/', router);

httpServer.listen(port,function(err){
  if (err){
    console.log('unable to listen ',err)
  } else {
    console.log('listening on port ',port)
  }
});
module.exports = app