const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const fsExtra = require('fs-extra');


// Create Express app
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    // Create a unique filename with timestamp and original extension
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniquePrefix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Store online users and their colors
const onlineUsers = new Set();
const userColors = {}; // Store user colors
let users = {}; // Store user data with DND status

// Message storage setup
const MESSAGES_FILE = path.join(__dirname, 'chat_messages.json');
const USER_COLORS_FILE = path.join(__dirname, 'user_colors.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Initialize messages from file or create new file
let chatMessages = [];
try {
    if (fs.existsSync(MESSAGES_FILE)) {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        chatMessages = JSON.parse(data);
    } else {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatMessages), 'utf8');
    }
} catch (error) {
    console.error('Error loading chat messages:', error);
}

// Initialize user colors from file or create new file
try {
    if (fs.existsSync(USER_COLORS_FILE)) {
        const data = fs.readFileSync(USER_COLORS_FILE, 'utf8');
        Object.assign(userColors, JSON.parse(data));
    } else {
        fs.writeFileSync(USER_COLORS_FILE, JSON.stringify(userColors), 'utf8');
    }
} catch (error) {
    console.error('Error loading user colors:', error);
}

// Save messages to file
function saveMessages() {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatMessages), 'utf8');
    } catch (error) {
        console.error('Error saving chat messages:', error);
    }
}

// Save user colors to file
function saveUserColors() {
    try {
        fs.writeFileSync(USER_COLORS_FILE, JSON.stringify(userColors), 'utf8');
    } catch (error) {
        console.error('Error saving user colors:', error);
    }
}

// Socket.IO connection handler
io.on('connection', (socket) => {
    // Get username from query params
    const username = socket.handshake.query.username;
    const userColor = socket.handshake.query.color;

    if (!username) {
        socket.disconnect();
        return;
    }

    // Store user color if provided
    if (userColor) {
        userColors[username] = userColor;
        saveUserColors();
    }

    // Add user to online users
    onlineUsers.add(username);

    // Log user connection
    console.log(`User connected: ${username} with socket ID: ${socket.id}`);

    // Initialize user data with DND status
    users[socket.id] = {
        username: username,
        dnd: false
    };

    // Handle user join
    socket.on('user_join', (data) => {
        // Broadcast user join to all clients
        io.emit('user_join', {
            username: data.username,
            users: Object.values(users), // Send users with DND status
            userColors: userColors // Send all user colors
        });

        // Add system message to chat history
        const joinMessage = {
            type: 'system',
            message: `${data.username} has joined the chat`,
            timestamp: new Date().toISOString()
        };

        chatMessages.push(joinMessage);
        saveMessages();
    });

    // Handle chat message
    socket.on('chat_message', (data) => {
        const messageData = {
            type: 'message',
            username: username,
            message: data.message,
            timestamp: new Date().toISOString(),
            color: userColors[username],
            // Add this line to handle image messages
            image: data.image || null
        };
    
        // Add message to chat history
        chatMessages.push(messageData);
        saveMessages();
    
        // Broadcast message to all clients
        io.emit('chat_message', messageData);
    });
    
    // Handle message history request
    socket.on('load_messages', (data) => {
        const page = data.page || 1;
        const pageSize = 20;
        const start = Math.max(0, chatMessages.length - (page * pageSize));
        const end = Math.max(0, chatMessages.length - ((page - 1) * pageSize));

        // Get messages for the requested page
        const messages = chatMessages.slice(start, end).reverse();

        // Send messages to the client
        socket.emit('chat_history', {
            messages,
            page,
            totalMessages: chatMessages.length,
            userColors: userColors // Send all user colors
        });
    });

    // Handle user color update
    socket.on('update_color', (data) => {
        if (data.color) {
            userColors[username] = data.color;
            saveUserColors();

            // Broadcast the updated colors to all clients
            io.emit('update_colors', {
                userColors: userColors
            });
        }
    });

    // Handle DND toggle event
    socket.on('dnd_toggle', (dndStatus) => {
        users[socket.id].dnd = dndStatus;
        io.emit('update_users', { users: Object.values(users) });
    });

    // Send updated user list on connection and disconnect.
    io.emit('update_users', { users: Object.values(users) });

    // Handle disconnect
    socket.on('disconnect', () => {
        // Remove user from online users
        onlineUsers.delete(username);
        
        // Remove user from users object with DND status
        delete users[socket.id];

        // Log user disconnection
        console.log(`User disconnected: ${username}`);

        // Add system message to chat history
        const leaveMessage = {
            type: 'system',
            message: `${username} has left the chat`,
            timestamp: new Date().toISOString()
        };

        chatMessages.push(leaveMessage);
        saveMessages();

        // Broadcast user leave to all clients
        io.emit('user_leave', {
            username: username,
            users: Object.values(users), // Send updated users list with DND status
            userColors: userColors // Send updated user colors
        });

        io.emit('update_users', { users: Object.values(users) });
    });
});

// Routes
// Add this before your existing routes
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Create the URL path for the uploaded file
    const filePath = `/uploads/${req.file.filename}`;
    
    return res.status(200).json({ 
      success: true, 
      filePath: filePath
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
