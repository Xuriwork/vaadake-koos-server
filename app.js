const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const shortid = require('shortid');

const app = express();
const server = require('http').Server(app);

app.get('/healthz', (req, res) => {
  res.send('Success')
})

const io = require('socket.io')(server, {
  cors: {
    origin: ['https://vaadakekoos.web.app', 'vaadakekoos.firebaseapp.com', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  }
});

const { addUser, removeUser, getUser, getAllUsersInRoom } = require('./actions/userActions');
const { addRoom, removeRoom, getRoomByName, getRoomByRoomId } = require('./actions/roomActions');
const { validatePasscode, validateMaxRoomSize, validateRoomId } = require('./utils/validators');

const {
  CHECK_IF_ROOM_REQUIRES_PASSCODE,
  GET_ROOM_CODE,
  VERIFY_PASSCODE,
  SET_ROOM_PASSCODE,
  CHANGE_ROOM_ID,
	PLAY,
  JOIN,
	PAUSE,
	SYNC_TIME,
	CHANGE_VIDEO,
	GET_VIDEO_INFORMATION,
  SYNC_VIDEO_INFORMATION,
  GET_HOST_TIME_AND_PLAYER_STATE,
  SYNC_WITH_HOST,
	SEND_MESSAGE,
	MESSAGE,
  NEW_USER_JOINED,
  SET_HOST,
  SET_NEW_HOST,
  NOTIFY_CLIENT_SUCCESS,
	NOTIFY_CLIENT_ERROR,
  GET_QUEUE,
  ADD_TO_QUEUE,
  REMOVE_FROM_QUEUE,
  GET_USERS,
  SET_MAX_ROOM_SIZE,
  CHECK_IF_ROOM_IS_FULL,
  GET_SHORT_URL,
  SYNC_BUTTON,
  QUEUE_REORDERED,
} = require('./SocketActions');

const PORT = process.env.PORT || 5000;

const origins = ['https://vaadakekoos.web.app', 'vaadakekoos.firebaseapp.com'];
const corsOptions = {
  origin: function (origin, callback) {
    if (origins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
};

app.use(express.static(__dirname + '/../../build'));
app.use(cors(corsOptions));

const requestIsNotFromHost = (socket) => {
  const room = getRoomByName(socket.roomName);
  return socket.id !== room.host;
};

io.on('connection', (socket) => {

  const sendClientUnsuccessNotification = (message) => {
    socket.emit(NOTIFY_CLIENT_ERROR, message);
  };  

  const sendClientSuccessNotification = (message) => {
    socket.emit(NOTIFY_CLIENT_SUCCESS, message);
  };

  socket.on(CHECK_IF_ROOM_IS_FULL, (roomName, callback) => {
    const room = getRoomByName(roomName);

    if (room && room.numberOfUsers === room.maxRoomSize) {
      return callback(true);
    };
    callback(false);
  });

  socket.on(CHECK_IF_ROOM_REQUIRES_PASSCODE, (roomName, callback) => {
    const room = getRoomByName(roomName);
    if (room && room.passcode) return callback(true);
    callback(false);
  });

  socket.on(VERIFY_PASSCODE, ({ roomName, passcode }, callback) => {
    if (!passcode) return;
    
    const room = getRoomByName(roomName);

    bcrypt.compare(passcode, room.passcode)
    .then((result) => {
      if (result === true) return callback(true);
      callback(false);
    });
  });

  socket.on(GET_SHORT_URL, (roomId, callback) => {
    const room = getRoomByRoomId(roomId);

    if (room && room.name) return callback(true, room.name);
    callback(false, null);
  });

  socket.on(JOIN, ({ username, roomName }) => {
    socket.leaveAll();

    addUser({ id: socket.id, username, roomName });

    const users = getAllUsersInRoom(roomName);
    const room = getRoomByName(roomName);
    if (!room) addRoom({ name: roomName, host: users[0].id, roomId: shortid.generate() });
    const { host } = getRoomByName(roomName);

    socket.join(roomName);
    socket.roomName = roomName;
    
    io.in(roomName).emit(MESSAGE, {
      type: 'SERVER-USER_JOINED',
      content: `${username} joined the room. 👋`
    });
    
    socket.to(roomName).emit(NEW_USER_JOINED);
    
    socket.emit(SET_HOST, host);
    io.in(roomName).emit(GET_USERS, users);

    const { maxRoomSize, roomId } = getRoomByName(socket.roomName);
    io.in(roomName).emit('GET_ROOM_INFO', { maxRoomSize, roomId });
  });

  socket.on(GET_ROOM_CODE, () => {
    const room = getRoomByName(socket.roomName);
    socket.emit(GET_ROOM_CODE, room.roomId);
  });

  socket.on(SET_NEW_HOST, (newHost) => {
    const user = getUser(newHost);
    const room = getRoomByName(socket.roomName);

    if (socket.id === room.host) {
      room.host = newHost;
      io.in(user.roomName).emit(SET_HOST, room.host);
      io.in(user.roomName).emit(MESSAGE, {
        type: 'NEW_HOST',
        content: `${user.username} is now the host. 👑`
      });
    };
  });

  socket.on(PLAY, () => {
    if (requestIsNotFromHost(socket)) return;

    const user = getUser(socket.id);
    socket.to(user.roomName).emit(PLAY);
  });

  socket.on(PAUSE, () => {
    if (requestIsNotFromHost(socket)) return;

    const user = getUser(socket.id);
    socket.to(user.roomName).emit(PAUSE);    
  });

  socket.on(SYNC_BUTTON, (callback) => {
    const room = getRoomByName(socket.roomName);
    io.sockets.connected[room.host].emit(GET_HOST_TIME_AND_PLAYER_STATE, ({ currentTime, playerState }) => callback({ currentTime, playerState }));
  });

  socket.on(SYNC_WITH_HOST, () => {
    const room = getRoomByName(socket.roomName);
    io.sockets.connected[room.host].emit(SYNC_WITH_HOST);
  });

  socket.on(SYNC_TIME, (currentTime) => {
    const user = getUser(socket.id);
    socket.to(user.roomName).emit(SYNC_TIME, currentTime);
  });

  socket.on(SYNC_VIDEO_INFORMATION, (data) => {
    io.sockets.connected[data.socketID].emit(SYNC_VIDEO_INFORMATION, data);
  });

  socket.on(GET_VIDEO_INFORMATION, () => {
    const room = getRoomByName(socket.roomName);
    io.sockets.connected[room.host].emit(GET_VIDEO_INFORMATION, socket.id);
  });

  socket.on(CHANGE_VIDEO, (videoURL) => {

    if (requestIsNotFromHost(socket)) {
      return sendClientUnsuccessNotification('Only the host can change videos 😉');
    };

    io.to(socket.roomName).emit(CHANGE_VIDEO, videoURL);
  });

  socket.on(GET_QUEUE, () => {
    const room = getRoomByName(socket.roomName);
    socket.emit(GET_QUEUE, room.queue);
  });

  socket.on(ADD_TO_QUEUE, (data) => {
    const room = getRoomByName(socket.roomName);

    const videoExist = room.queue.find((video) => video.id === data.id);
    if (!!videoExist) return;

    room.queue.push(data);
    io.to(socket.roomName).emit(GET_QUEUE, room.queue);
  });

  socket.on(REMOVE_FROM_QUEUE, (videoToRemove) => {
    const room = getRoomByName(socket.roomName);
    const queue = room.queue;

    const index = queue.findIndex((video) => video.id === videoToRemove);
    if (index !== -1) queue.splice(index, 1);

    io.to(socket.roomName).emit(GET_QUEUE, queue);
  });

  socket.on(QUEUE_REORDERED, (queue) => {
    if (requestIsNotFromHost(socket)) return;

    io.to(socket.roomName).emit(GET_QUEUE, queue);
  });

  socket.on(SEND_MESSAGE, (data) => {
    const user = getUser(socket.id);
    io.in(user.roomName).emit(MESSAGE, { 
      username: user.username, 
      content: data.content, 
      id: socket.id 
    });
  });

  socket.on(CHANGE_ROOM_ID, (newRoomId, callback) => {
    const room = getRoomByName(socket.roomName);
    if (requestIsNotFromHost(socket)) return;

    const { valid, error } = validateRoomId(newRoomId);
    if (!valid) return sendClientUnsuccessNotification(error);

    room.id = newRoomId;
    callback(true, 'Room Id successfully changed');

    io.in(room.name).emit('GET_ROOM_INFO', { maxRoomSize: room.maxRoomSize, roomId: room.roomId });
  });

  socket.on(SET_ROOM_PASSCODE, (passcode) => {
    const room = getRoomByName(socket.roomName);
    if (requestIsNotFromHost(socket)) return;

    const { valid, error } = validatePasscode(passcode);
    if (!valid) return sendClientUnsuccessNotification(error);

    if (passcode.length > 50) {
      return sendClientUnsuccessNotification('Room Passcode can only be up to 50 characters');
    };
    
    bcrypt.hash(passcode, 10)
    .then((hash) => {
      room.passcode = hash;
      sendClientSuccessNotification('Passcode successfully set');
    })
    .catch((error) => console.error('Error generating a hash: ', error));
  });

  socket.on(SET_MAX_ROOM_SIZE, (newMaxRoomSize) => {
    const room = getRoomByName(socket.roomName);
    const users = getAllUsersInRoom(socket.roomName);
    if (requestIsNotFromHost(socket)) return;

    const { valid, error } = validateMaxRoomSize(newMaxRoomSize, users.length);
    if (!valid) return sendClientUnsuccessNotification(error);

    room.maxRoomSize = newMaxRoomSize;
    io.in(room.name).emit('GET_ROOM_INFO', { maxRoomSize: room.maxRoomSize, roomId: room.roomId });
    sendClientSuccessNotification('Room settings saved successfully');
  });

  socket.on('disconnect', () => {
      const user = removeUser(socket.id);
      if (user) {
        const room = getRoomByName(socket.roomName);

				const userWasAdmin = socket.id === room.host;
				const users = getAllUsersInRoom(user.roomName);

				if (userWasAdmin && users.length > 0) {
					room.host = users[0].id;

					io.in(user.roomName).emit(SET_HOST, room.host);
					io.in(user.roomName).emit(MESSAGE, {
						type: 'NEW_HOST',
						content: `${users[0].username} is now the host. 👑`,
					});
				} else if (users.length === 0) {
					removeRoom(socket.roomName);
				}

				io.in(user.roomName).emit(MESSAGE, {
					type: 'SERVER-USER_LEFT',
					content: `${user.username} has left the room.`,
				});

				io.in(user.roomName).emit(GET_USERS, users);
      };
    });
});

server.listen(PORT, () => console.log('Server is listening on: ' + PORT));

module.exports = server;