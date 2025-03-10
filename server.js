// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configure middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const users = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  const username = socket.handshake.query.username;
  users[socket.id] = username;
  
  console.log(`${username} connected with socket ID: ${socket.id}`);
  
  // Send the updated users list to all clients
  io.emit('update_users', {
    users: Object.values(users)
  });
  
  // Handle user joining
  socket.on('user_join', (data) => {
    io.emit('user_join', {
      username: data.username,
      users: Object.values(users)
    });
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    io.emit('chat_message', {
      username: users[socket.id],
      message: data.message
    });
  });
  
  // Handle user disconnect
  socket.on('disconnect', () => {
    const username = users[socket.id];
    console.log(`${username} disconnected`);
    
    delete users[socket.id];
    
    io.emit('user_leave', {
      username: username,
      users: Object.values(users)
    });
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
