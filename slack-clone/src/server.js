import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { userDB, channelDB, messageDB, reactionDB, dmDB } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Track online users
const onlineUsers = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> Set of socketIds

// ============ REST API Routes ============

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { username, displayName, password } = req.body;
  
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const user = userDB.create(username, displayName, password);
  
  if (!user) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  // Auto-join general channel
  const generalChannel = channelDB.getByName('general');
  if (generalChannel) {
    channelDB.addMember(generalChannel.id, user.id);
  }
  
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const user = userDB.authenticate(username, password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ user });
});

// User routes
app.get('/api/users', (req, res) => {
  const users = userDB.getAll();
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = userDB.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.patch('/api/users/:id', (req, res) => {
  const { displayName } = req.body;
  const user = userDB.updateProfile(req.params.id, displayName);
  res.json(user);
});

// Channel routes
app.get('/api/channels', (req, res) => {
  const channels = channelDB.getAll();
  res.json(channels);
});

app.get('/api/channels/:id', (req, res) => {
  const channel = channelDB.getById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json(channel);
});

app.post('/api/channels', (req, res) => {
  const { name, description, userId, isPrivate } = req.body;
  
  if (!name || !userId) {
    return res.status(400).json({ error: 'Name and userId are required' });
  }
  
  // Validate channel name
  const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  
  const channel = channelDB.create(cleanName, description, userId, isPrivate);
  
  if (!channel) {
    return res.status(400).json({ error: 'Channel name already exists' });
  }
  
  // Broadcast new channel to all users
  io.emit('channel:created', channel);
  
  res.json(channel);
});

app.get('/api/channels/:id/members', (req, res) => {
  const members = channelDB.getMembers(req.params.id);
  res.json(members);
});

app.post('/api/channels/:id/join', (req, res) => {
  const { userId } = req.body;
  const channelId = req.params.id;
  
  const success = channelDB.addMember(channelId, userId);
  
  if (success) {
    const user = userDB.getById(userId);
    io.to(`channel:${channelId}`).emit('channel:member_joined', { channelId, user });
  }
  
  res.json({ success });
});

app.post('/api/channels/:id/leave', (req, res) => {
  const { userId } = req.body;
  const channelId = req.params.id;
  
  channelDB.removeMember(channelId, userId);
  io.to(`channel:${channelId}`).emit('channel:member_left', { channelId, userId });
  
  res.json({ success: true });
});

// Message routes
app.get('/api/channels/:id/messages', (req, res) => {
  const { before, limit } = req.query;
  const messages = messageDB.getByChannel(req.params.id, parseInt(limit) || 100, before);
  res.json(messages);
});

app.post('/api/channels/:id/messages', (req, res) => {
  const { userId, content } = req.body;
  const channelId = req.params.id;
  
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  
  const message = messageDB.create(channelId, userId, content.trim());
  
  // Broadcast to channel
  io.to(`channel:${channelId}`).emit('message:new', message);
  
  res.json(message);
});

app.patch('/api/messages/:id', (req, res) => {
  const { content } = req.body;
  const message = messageDB.update(req.params.id, content);
  
  io.to(`channel:${message.channel_id}`).emit('message:updated', message);
  
  res.json(message);
});

app.delete('/api/messages/:id', (req, res) => {
  const message = messageDB.getById(req.params.id);
  if (message) {
    messageDB.delete(req.params.id);
    io.to(`channel:${message.channel_id}`).emit('message:deleted', { id: req.params.id, channelId: message.channel_id });
  }
  res.json({ success: true });
});

// Reaction routes
app.post('/api/messages/:id/reactions', (req, res) => {
  const { userId, emoji } = req.body;
  const messageId = req.params.id;
  
  reactionDB.add(messageId, userId, emoji);
  const reactions = reactionDB.getForMessage(messageId);
  
  const message = messageDB.getById(messageId);
  io.to(`channel:${message.channel_id}`).emit('message:reactions_updated', { messageId, reactions });
  
  res.json(reactions);
});

app.delete('/api/messages/:id/reactions', (req, res) => {
  const { userId, emoji } = req.body;
  const messageId = req.params.id;
  
  reactionDB.remove(messageId, userId, emoji);
  const reactions = reactionDB.getForMessage(messageId);
  
  const message = messageDB.getById(messageId);
  io.to(`channel:${message.channel_id}`).emit('message:reactions_updated', { messageId, reactions });
  
  res.json(reactions);
});

// Direct message routes
app.get('/api/dm/conversations', (req, res) => {
  const { userId } = req.query;
  const conversations = dmDB.getConversations(userId);
  res.json(conversations);
});

app.get('/api/dm/:userId1/:userId2', (req, res) => {
  const messages = dmDB.getConversation(req.params.userId1, req.params.userId2);
  res.json(messages);
});

app.post('/api/dm', (req, res) => {
  const { senderId, receiverId, content } = req.body;
  
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  
  const message = dmDB.create(senderId, receiverId, content.trim());
  
  // Send to both users' sockets
  const receiverSockets = userSockets.get(receiverId);
  const senderSockets = userSockets.get(senderId);
  
  if (receiverSockets) {
    receiverSockets.forEach(socketId => {
      io.to(socketId).emit('dm:new', message);
    });
  }
  
  if (senderSockets) {
    senderSockets.forEach(socketId => {
      io.to(socketId).emit('dm:new', message);
    });
  }
  
  res.json(message);
});

// Search
app.get('/api/search', (req, res) => {
  const { q, channelId } = req.query;
  const results = messageDB.search(q, channelId);
  res.json(results);
});

// User's channels
app.get('/api/users/:id/channels', (req, res) => {
  const channels = channelDB.getUserChannels(req.params.id);
  res.json(channels);
});

// ============ Socket.io Events ============

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // User authentication/identification
  socket.on('user:connect', (userId) => {
    onlineUsers.set(socket.id, userId);
    
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    
    // Update user status
    userDB.updateStatus(userId, 'online');
    
    // Broadcast online status
    io.emit('user:status_changed', { userId, status: 'online' });
    
    // Join user's channels
    const channels = channelDB.getUserChannels(userId);
    channels.forEach(channel => {
      socket.join(`channel:${channel.id}`);
    });
  });
  
  // Join a channel room
  socket.on('channel:join', (channelId) => {
    socket.join(`channel:${channelId}`);
  });
  
  // Leave a channel room
  socket.on('channel:leave', (channelId) => {
    socket.leave(`channel:${channelId}`);
  });
  
  // Typing indicators
  socket.on('typing:start', ({ channelId, userId, displayName }) => {
    socket.to(`channel:${channelId}`).emit('typing:start', { channelId, userId, displayName });
  });
  
  socket.on('typing:stop', ({ channelId, userId }) => {
    socket.to(`channel:${channelId}`).emit('typing:stop', { channelId, userId });
  });
  
  // DM typing
  socket.on('dm:typing:start', ({ senderId, receiverId, displayName }) => {
    const receiverSockets = userSockets.get(receiverId);
    if (receiverSockets) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('dm:typing:start', { senderId, displayName });
      });
    }
  });
  
  socket.on('dm:typing:stop', ({ senderId, receiverId }) => {
    const receiverSockets = userSockets.get(receiverId);
    if (receiverSockets) {
      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('dm:typing:stop', { senderId });
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = onlineUsers.get(socket.id);
    
    if (userId) {
      onlineUsers.delete(socket.id);
      
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        
        // Only mark as offline if no more connections
        if (sockets.size === 0) {
          userSockets.delete(userId);
          userDB.updateStatus(userId, 'offline');
          io.emit('user:status_changed', { userId, status: 'offline' });
        }
      }
    }
    
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Slack Clone server running on http://localhost:${PORT}`);
});
