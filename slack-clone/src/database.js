import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const db = new Database('slack-clone.db');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    status TEXT DEFAULT 'online',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_private INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT REFERENCES channels(id),
    user_id TEXT REFERENCES users(id),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id TEXT REFERENCES channels(id),
    user_id TEXT REFERENCES users(id),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS direct_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT REFERENCES users(id),
    receiver_id TEXT REFERENCES users(id),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES messages(id),
    user_id TEXT REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
`);

// Helper to generate avatar colors
const avatarColors = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
  '#FF9800', '#FF5722', '#795548', '#607D8B'
];

function getRandomColor() {
  return avatarColors[Math.floor(Math.random() * avatarColors.length)];
}

// User operations
export const userDB = {
  create(username, displayName, password) {
    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarColor = getRandomColor();
    
    try {
      db.prepare(`
        INSERT INTO users (id, username, display_name, password_hash, avatar_color)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, username, displayName, passwordHash, avatarColor);
      
      return this.getById(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  },

  authenticate(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return null;
    
    if (bcrypt.compareSync(password, user.password_hash)) {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  },

  getById(id) {
    const user = db.prepare('SELECT id, username, display_name, avatar_color, status, created_at FROM users WHERE id = ?').get(id);
    return user;
  },

  getByUsername(username) {
    return db.prepare('SELECT id, username, display_name, avatar_color, status, created_at FROM users WHERE username = ?').get(username);
  },

  getAll() {
    return db.prepare('SELECT id, username, display_name, avatar_color, status, created_at FROM users').all();
  },

  updateStatus(id, status) {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    return this.getById(id);
  },

  updateProfile(id, displayName) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, id);
    return this.getById(id);
  }
};

// Channel operations
export const channelDB = {
  create(name, description, createdBy, isPrivate = false) {
    const id = uuidv4();
    
    try {
      db.prepare(`
        INSERT INTO channels (id, name, description, created_by, is_private)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, description, createdBy, isPrivate ? 1 : 0);
      
      // Add creator as member
      this.addMember(id, createdBy);
      
      return this.getById(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  },

  getById(id) {
    return db.prepare(`
      SELECT c.*, u.display_name as creator_name
      FROM channels c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(id);
  },

  getByName(name) {
    return db.prepare('SELECT * FROM channels WHERE name = ?').get(name);
  },

  getAll() {
    return db.prepare(`
      SELECT c.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
      FROM channels c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.is_private = 0
      ORDER BY c.name
    `).all();
  },

  getUserChannels(userId) {
    return db.prepare(`
      SELECT c.*, u.display_name as creator_name
      FROM channels c
      JOIN channel_members cm ON c.id = cm.channel_id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE cm.user_id = ?
      ORDER BY c.name
    `).all(userId);
  },

  addMember(channelId, userId) {
    try {
      db.prepare('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
      return true;
    } catch {
      return false;
    }
  },

  removeMember(channelId, userId) {
    db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(channelId, userId);
  },

  getMembers(channelId) {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_color, u.status
      FROM users u
      JOIN channel_members cm ON u.id = cm.user_id
      WHERE cm.channel_id = ?
    `).all(channelId);
  },

  isMember(channelId, userId) {
    const result = db.prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?').get(channelId, userId);
    return !!result;
  }
};

// Message operations
export const messageDB = {
  create(channelId, userId, content, messageType = 'text') {
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO messages (id, channel_id, user_id, content, message_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, channelId, userId, content, messageType);
    
    return this.getById(id);
  },

  getById(id) {
    return db.prepare(`
      SELECT m.*, u.username, u.display_name, u.avatar_color
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(id);
  },

  getByChannel(channelId, limit = 100, before = null) {
    let query = `
      SELECT m.*, u.username, u.display_name, u.avatar_color
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
    `;
    
    const params = [channelId];
    
    if (before) {
      query += ' AND m.created_at < ?';
      params.push(before);
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);
    
    const messages = db.prepare(query).all(...params);
    
    // Get reactions for these messages
    const messageIds = messages.map(m => m.id);
    if (messageIds.length > 0) {
      const reactionsQuery = db.prepare(`
        SELECT r.*, u.display_name as user_name
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.message_id IN (${messageIds.map(() => '?').join(',')})
      `);
      const reactions = reactionsQuery.all(...messageIds);
      
      // Group reactions by message
      const reactionsByMessage = {};
      reactions.forEach(r => {
        if (!reactionsByMessage[r.message_id]) {
          reactionsByMessage[r.message_id] = [];
        }
        reactionsByMessage[r.message_id].push(r);
      });
      
      messages.forEach(m => {
        m.reactions = reactionsByMessage[m.id] || [];
      });
    }
    
    return messages.reverse();
  },

  update(id, content) {
    db.prepare('UPDATE messages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, id);
    return this.getById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM reactions WHERE message_id = ?').run(id);
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  },

  search(query, channelId = null) {
    let sql = `
      SELECT m.*, u.username, u.display_name, u.avatar_color, c.name as channel_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      WHERE m.content LIKE ?
    `;
    
    const params = [`%${query}%`];
    
    if (channelId) {
      sql += ' AND m.channel_id = ?';
      params.push(channelId);
    }
    
    sql += ' ORDER BY m.created_at DESC LIMIT 50';
    
    return db.prepare(sql).all(...params);
  }
};

// Reaction operations
export const reactionDB = {
  add(messageId, userId, emoji) {
    const id = uuidv4();
    try {
      db.prepare(`
        INSERT INTO reactions (id, message_id, user_id, emoji)
        VALUES (?, ?, ?, ?)
      `).run(id, messageId, userId, emoji);
      return true;
    } catch {
      return false;
    }
  },

  remove(messageId, userId, emoji) {
    db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(messageId, userId, emoji);
  },

  getForMessage(messageId) {
    return db.prepare(`
      SELECT r.*, u.display_name as user_name
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ?
    `).all(messageId);
  }
};

// Direct message operations
export const dmDB = {
  create(senderId, receiverId, content) {
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO direct_messages (id, sender_id, receiver_id, content)
      VALUES (?, ?, ?, ?)
    `).run(id, senderId, receiverId, content);
    
    return this.getById(id);
  },

  getById(id) {
    return db.prepare(`
      SELECT dm.*, 
        s.username as sender_username, s.display_name as sender_name, s.avatar_color as sender_color,
        r.username as receiver_username, r.display_name as receiver_name, r.avatar_color as receiver_color
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      JOIN users r ON dm.receiver_id = r.id
      WHERE dm.id = ?
    `).get(id);
  },

  getConversation(userId1, userId2, limit = 100) {
    return db.prepare(`
      SELECT dm.*, 
        s.username as sender_username, s.display_name as sender_name, s.avatar_color as sender_color
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
         OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.created_at DESC
      LIMIT ?
    `).all(userId1, userId2, userId2, userId1, limit).reverse();
  },

  getConversations(userId) {
    return db.prepare(`
      SELECT DISTINCT
        CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END as other_user_id,
        u.username, u.display_name, u.avatar_color, u.status,
        (SELECT content FROM direct_messages 
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM direct_messages 
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM direct_messages dm
      JOIN users u ON u.id = CASE WHEN dm.sender_id = ? THEN dm.receiver_id ELSE dm.sender_id END
      WHERE dm.sender_id = ? OR dm.receiver_id = ?
      ORDER BY last_message_at DESC
    `).all(userId, userId, userId, userId, userId, userId, userId, userId);
  }
};

// Create default channels if they don't exist
const generalChannel = channelDB.getByName('general');
if (!generalChannel) {
  // Create a system user for initial setup
  let systemUser = userDB.getByUsername('system');
  if (!systemUser) {
    systemUser = userDB.create('system', 'System', 'system123');
  }
  
  channelDB.create('general', 'General discussion for everyone', systemUser.id);
  channelDB.create('random', 'Random conversations and fun stuff', systemUser.id);
  channelDB.create('announcements', 'Important announcements', systemUser.id);
}

export default db;
