// ==================== STATE ====================
const state = {
  user: null,
  currentChannel: null,
  currentDM: null,
  channels: [],
  messages: [],
  users: [],
  typingUsers: new Map(),
  view: 'channels' // 'channels', 'dms', 'search'
};

// Socket.io connection
let socket = null;

// ==================== DOM ELEMENTS ====================
const elements = {
  // Screens
  authScreen: document.getElementById('auth-screen'),
  appScreen: document.getElementById('app-screen'),
  
  // Auth
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginError: document.getElementById('login-error'),
  registerError: document.getElementById('register-error'),
  
  // Sidebars
  channelsSidebar: document.getElementById('channels-sidebar'),
  dmsSidebar: document.getElementById('dms-sidebar'),
  searchSidebar: document.getElementById('search-sidebar'),
  
  // Lists
  channelsList: document.getElementById('channels-list'),
  onlineUsersList: document.getElementById('online-users-list'),
  dmList: document.getElementById('dm-list'),
  allUsersList: document.getElementById('all-users-list'),
  
  // Content
  messagesContainer: document.getElementById('messages-container'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  channelName: document.getElementById('channel-name'),
  channelDescription: document.getElementById('channel-description'),
  memberCount: document.getElementById('member-count'),
  onlineCount: document.getElementById('online-count'),
  contentHeader: document.getElementById('content-header'),
  
  // Typing
  typingIndicator: document.getElementById('typing-indicator'),
  typingText: document.getElementById('typing-text'),
  
  // User
  currentUserAvatar: document.getElementById('current-user-avatar'),
  userMenu: document.getElementById('user-menu'),
  menuUserAvatar: document.getElementById('menu-user-avatar'),
  menuDisplayName: document.getElementById('menu-display-name'),
  menuUsername: document.getElementById('menu-username'),
  
  // Modals
  channelModal: document.getElementById('channel-modal'),
  membersModal: document.getElementById('members-modal'),
  modalMembersList: document.getElementById('modal-members-list'),
  
  // Search
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  
  // Emoji
  emojiPicker: document.getElementById('emoji-picker')
};

// ==================== API CALLS ====================
const api = {
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  
  async patch(url, data) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  async delete(url, data) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    return res.json();
  }
};

// ==================== UTILITIES ====================
function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // Today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  
  // This week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + 
           date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  
  // Older
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessageContent(text) {
  // Escape HTML first
  let formatted = escapeHtml(text);
  
  // Code blocks (inline)
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==================== RENDERING ====================
function renderAvatar(name, color, size = 'normal') {
  const sizeClass = size === 'small' ? 'avatar-small' : '';
  return `<div class="avatar ${sizeClass}" style="background: ${color}">${getInitials(name)}</div>`;
}

function renderChannelsList() {
  elements.channelsList.innerHTML = state.channels.map(channel => `
    <div class="channel-item ${state.currentChannel?.id === channel.id ? 'active' : ''}" 
         data-channel-id="${channel.id}">
      <span class="hash">#</span>
      <span>${escapeHtml(channel.name)}</span>
    </div>
  `).join('');
}

function renderOnlineUsers() {
  const onlineUsers = state.users.filter(u => u.status === 'online' && u.id !== state.user?.id);
  elements.onlineCount.textContent = onlineUsers.length;
  
  elements.onlineUsersList.innerHTML = onlineUsers.map(user => `
    <div class="user-item" data-user-id="${user.id}">
      ${renderAvatar(user.display_name, user.avatar_color)}
      <span class="user-name">${escapeHtml(user.display_name)}</span>
      <span class="status-indicator online"></span>
    </div>
  `).join('');
}

function renderAllUsers() {
  const otherUsers = state.users.filter(u => u.id !== state.user?.id);
  
  elements.allUsersList.innerHTML = otherUsers.map(user => `
    <div class="user-item" data-user-id="${user.id}" data-start-dm="true">
      ${renderAvatar(user.display_name, user.avatar_color)}
      <span class="user-name">${escapeHtml(user.display_name)}</span>
      <span class="status-indicator ${user.status}"></span>
    </div>
  `).join('');
}

function renderDMList(conversations) {
  elements.dmList.innerHTML = conversations.map(conv => `
    <div class="dm-item ${state.currentDM === conv.other_user_id ? 'active' : ''}" 
         data-user-id="${conv.other_user_id}">
      <div style="position: relative;">
        ${renderAvatar(conv.display_name, conv.avatar_color)}
        <span class="dm-status ${conv.status}"></span>
      </div>
      <div class="dm-info">
        <div class="dm-name">${escapeHtml(conv.display_name)}</div>
        ${conv.last_message ? `<div class="dm-preview">${escapeHtml(conv.last_message)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderMessages() {
  if (state.messages.length === 0) {
    elements.messagesContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h3>No messages yet</h3>
        <p>Be the first to send a message in this channel!</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  let lastDate = null;
  let lastUserId = null;
  let lastMessageTime = null;
  
  state.messages.forEach((message, index) => {
    const messageDate = new Date(message.created_at).toDateString();
    
    // Date separator
    if (messageDate !== lastDate) {
      html += `
        <div class="system-message">
          <span class="date">${formatDate(message.created_at)}</span>
        </div>
      `;
      lastDate = messageDate;
      lastUserId = null;
    }
    
    // Check if compact (same user, within 5 minutes)
    const currentTime = new Date(message.created_at).getTime();
    const isCompact = lastUserId === message.user_id && 
                      lastMessageTime && 
                      (currentTime - lastMessageTime) < 5 * 60 * 1000;
    
    // Reactions
    const reactionsHtml = message.reactions?.length > 0 ? renderReactions(message) : '';
    
    html += `
      <div class="message ${isCompact ? 'compact' : ''}" data-message-id="${message.id}">
        ${renderAvatar(message.display_name, message.avatar_color)}
        <div class="message-content">
          <div class="message-header">
            <span class="message-author">${escapeHtml(message.display_name)}</span>
            <span class="message-time">${formatTime(message.created_at)}</span>
            ${message.updated_at ? '<span class="message-edited">(edited)</span>' : ''}
          </div>
          <div class="message-text">${formatMessageContent(message.content)}</div>
          ${reactionsHtml}
        </div>
        <div class="message-actions">
          <button class="message-action-btn add-reaction-btn" title="Add reaction">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>
          ${message.user_id === state.user?.id ? `
            <button class="message-action-btn delete-message-btn" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    lastUserId = message.user_id;
    lastMessageTime = currentTime;
  });
  
  elements.messagesContainer.innerHTML = html;
  scrollToBottom();
}

function renderReactions(message) {
  // Group reactions by emoji
  const grouped = {};
  message.reactions.forEach(r => {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { count: 0, users: [], userIds: [] };
    }
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user_name);
    grouped[r.emoji].userIds.push(r.user_id);
  });
  
  return `
    <div class="message-reactions">
      ${Object.entries(grouped).map(([emoji, data]) => `
        <button class="reaction ${data.userIds.includes(state.user?.id) ? 'mine' : ''}" 
                data-emoji="${emoji}"
                title="${data.users.join(', ')}">
          <span>${emoji}</span>
          <span class="reaction-count">${data.count}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderMembersList(members) {
  elements.modalMembersList.innerHTML = members.map(member => `
    <div class="member-item">
      ${renderAvatar(member.display_name, member.avatar_color)}
      <div class="member-info">
        <div class="name">${escapeHtml(member.display_name)}</div>
        <div class="username">@${escapeHtml(member.username)}</div>
      </div>
      <div class="member-status ${member.status}">${member.status}</div>
    </div>
  `).join('');
}

function renderSearchResults(results) {
  if (results.length === 0) {
    elements.searchResults.innerHTML = '<p class="search-hint">No messages found</p>';
    return;
  }
  
  elements.searchResults.innerHTML = results.map(msg => `
    <div class="search-result-item" data-channel-id="${msg.channel_id}">
      <div class="search-result-header">
        ${renderAvatar(msg.display_name, msg.avatar_color)}
        <span class="name">${escapeHtml(msg.display_name)}</span>
        <span class="channel">#${escapeHtml(msg.channel_name)}</span>
      </div>
      <div class="search-result-content">${escapeHtml(msg.content)}</div>
    </div>
  `).join('');
}

function scrollToBottom() {
  setTimeout(() => {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }, 10);
}

function updateTypingIndicator() {
  const typingArray = Array.from(state.typingUsers.values());
  
  if (typingArray.length === 0) {
    elements.typingIndicator.style.display = 'none';
    return;
  }
  
  elements.typingIndicator.style.display = 'flex';
  
  if (typingArray.length === 1) {
    elements.typingText.textContent = `${typingArray[0]} is typing...`;
  } else if (typingArray.length === 2) {
    elements.typingText.textContent = `${typingArray[0]} and ${typingArray[1]} are typing...`;
  } else {
    elements.typingText.textContent = `${typingArray.length} people are typing...`;
  }
}

// ==================== AUTH ====================
function initAuth() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      document.getElementById(`${tab}-form`).classList.add('active');
    });
  });
  
  // Login
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.loginError.textContent = '';
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const result = await api.post('/api/auth/login', { username, password });
    
    if (result.error) {
      elements.loginError.textContent = result.error;
      return;
    }
    
    loginSuccess(result.user);
  });
  
  // Register
  elements.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.registerError.textContent = '';
    
    const username = document.getElementById('register-username').value;
    const displayName = document.getElementById('register-display').value;
    const password = document.getElementById('register-password').value;
    
    const result = await api.post('/api/auth/register', { username, displayName, password });
    
    if (result.error) {
      elements.registerError.textContent = result.error;
      return;
    }
    
    loginSuccess(result.user);
  });
}

function loginSuccess(user) {
  state.user = user;
  localStorage.setItem('slack-user', JSON.stringify(user));
  
  // Update UI
  elements.currentUserAvatar.style.background = user.avatar_color;
  elements.currentUserAvatar.textContent = getInitials(user.display_name);
  
  elements.menuUserAvatar.style.background = user.avatar_color;
  elements.menuUserAvatar.textContent = getInitials(user.display_name);
  elements.menuDisplayName.textContent = user.display_name;
  elements.menuUsername.textContent = `@${user.username}`;
  
  // Switch screens
  elements.authScreen.classList.remove('active');
  elements.appScreen.classList.add('active');
  
  // Initialize app
  initializeApp();
}

function logout() {
  state.user = null;
  localStorage.removeItem('slack-user');
  
  if (socket) {
    socket.disconnect();
  }
  
  elements.appScreen.classList.remove('active');
  elements.authScreen.classList.add('active');
  
  // Clear forms
  elements.loginForm.reset();
  elements.registerForm.reset();
}

// ==================== SOCKET.IO ====================
function initSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('user:connect', state.user.id);
  });
  
  // User status
  socket.on('user:status_changed', ({ userId, status }) => {
    const user = state.users.find(u => u.id === userId);
    if (user) {
      user.status = status;
      renderOnlineUsers();
      renderAllUsers();
    }
  });
  
  // Messages
  socket.on('message:new', (message) => {
    if (state.view === 'channels' && message.channel_id === state.currentChannel?.id) {
      state.messages.push(message);
      renderMessages();
    }
  });
  
  socket.on('message:updated', (message) => {
    const index = state.messages.findIndex(m => m.id === message.id);
    if (index !== -1) {
      state.messages[index] = message;
      renderMessages();
    }
  });
  
  socket.on('message:deleted', ({ id }) => {
    state.messages = state.messages.filter(m => m.id !== id);
    renderMessages();
  });
  
  socket.on('message:reactions_updated', ({ messageId, reactions }) => {
    const message = state.messages.find(m => m.id === messageId);
    if (message) {
      message.reactions = reactions;
      renderMessages();
    }
  });
  
  // Channel events
  socket.on('channel:created', (channel) => {
    state.channels.push(channel);
    renderChannelsList();
  });
  
  socket.on('channel:member_joined', ({ channelId, user }) => {
    if (channelId === state.currentChannel?.id) {
      loadChannelMembers(channelId);
    }
  });
  
  // Typing
  socket.on('typing:start', ({ channelId, userId, displayName }) => {
    if (channelId === state.currentChannel?.id && userId !== state.user.id) {
      state.typingUsers.set(userId, displayName);
      updateTypingIndicator();
    }
  });
  
  socket.on('typing:stop', ({ channelId, userId }) => {
    if (channelId === state.currentChannel?.id) {
      state.typingUsers.delete(userId);
      updateTypingIndicator();
    }
  });
  
  // DM events
  socket.on('dm:new', (message) => {
    if (state.view === 'dms' && 
        ((message.sender_id === state.currentDM) || (message.receiver_id === state.currentDM))) {
      state.messages.push(message);
      renderMessages();
    }
  });
  
  socket.on('dm:typing:start', ({ senderId, displayName }) => {
    if (senderId === state.currentDM) {
      state.typingUsers.set(senderId, displayName);
      updateTypingIndicator();
    }
  });
  
  socket.on('dm:typing:stop', ({ senderId }) => {
    state.typingUsers.delete(senderId);
    updateTypingIndicator();
  });
}

// ==================== APP INITIALIZATION ====================
async function initializeApp() {
  // Load initial data
  await Promise.all([
    loadChannels(),
    loadUsers()
  ]);
  
  // Initialize socket
  initSocket();
  
  // Select first channel
  if (state.channels.length > 0) {
    selectChannel(state.channels[0]);
  }
  
  // Initialize event listeners
  initEventListeners();
}

async function loadChannels() {
  state.channels = await api.get('/api/channels');
  renderChannelsList();
}

async function loadUsers() {
  state.users = await api.get('/api/users');
  renderOnlineUsers();
  renderAllUsers();
}

async function loadChannelMessages(channelId) {
  state.messages = await api.get(`/api/channels/${channelId}/messages`);
  renderMessages();
}

async function loadChannelMembers(channelId) {
  const members = await api.get(`/api/channels/${channelId}/members`);
  elements.memberCount.textContent = members.length;
  return members;
}

async function selectChannel(channel) {
  state.currentChannel = channel;
  state.currentDM = null;
  state.typingUsers.clear();
  
  // Update UI
  elements.channelName.textContent = channel.name;
  elements.channelDescription.textContent = channel.description || '';
  elements.messageInput.placeholder = `Message #${channel.name}`;
  
  // Update header style
  elements.contentHeader.querySelector('.channel-hash').textContent = '#';
  elements.contentHeader.querySelector('.channel-hash').style.display = '';
  
  // Join socket room
  socket.emit('channel:join', channel.id);
  
  // Load messages and members
  await Promise.all([
    loadChannelMessages(channel.id),
    loadChannelMembers(channel.id)
  ]);
  
  renderChannelsList();
  updateTypingIndicator();
}

async function selectDM(userId) {
  state.currentDM = userId;
  state.currentChannel = null;
  state.typingUsers.clear();
  
  const user = state.users.find(u => u.id === userId);
  
  // Update UI
  elements.channelName.textContent = user.display_name;
  elements.channelDescription.textContent = `@${user.username}`;
  elements.messageInput.placeholder = `Message ${user.display_name}`;
  
  // Update header style
  elements.contentHeader.querySelector('.channel-hash').style.display = 'none';
  
  // Load DM conversation
  state.messages = await api.get(`/api/dm/${state.user.id}/${userId}`);
  
  // Normalize DM messages to look like channel messages
  state.messages = state.messages.map(msg => ({
    ...msg,
    user_id: msg.sender_id,
    display_name: msg.sender_name,
    avatar_color: msg.sender_color
  }));
  
  renderMessages();
  updateTypingIndicator();
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
  // View switching
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
  
  // Channel selection
  elements.channelsList.addEventListener('click', (e) => {
    const channelItem = e.target.closest('.channel-item');
    if (channelItem) {
      const channelId = channelItem.dataset.channelId;
      const channel = state.channels.find(c => c.id === channelId);
      if (channel) {
        switchView('channels');
        selectChannel(channel);
      }
    }
  });
  
  // DM selection
  elements.dmList.addEventListener('click', (e) => {
    const dmItem = e.target.closest('.dm-item');
    if (dmItem) {
      selectDM(dmItem.dataset.userId);
    }
  });
  
  // Start new DM from user list
  elements.allUsersList.addEventListener('click', (e) => {
    const userItem = e.target.closest('.user-item');
    if (userItem) {
      selectDM(userItem.dataset.userId);
    }
  });
  
  // Click on online user to start DM
  elements.onlineUsersList.addEventListener('click', (e) => {
    const userItem = e.target.closest('.user-item');
    if (userItem) {
      switchView('dms');
      selectDM(userItem.dataset.userId);
    }
  });
  
  // Message sending
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Typing indicator
  let typingTimeout;
  elements.messageInput.addEventListener('input', () => {
    // Auto-resize textarea
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 200) + 'px';
    
    // Emit typing
    if (state.view === 'channels' && state.currentChannel) {
      socket.emit('typing:start', {
        channelId: state.currentChannel.id,
        userId: state.user.id,
        displayName: state.user.display_name
      });
      
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('typing:stop', {
          channelId: state.currentChannel.id,
          userId: state.user.id
        });
      }, 2000);
    } else if (state.view === 'dms' && state.currentDM) {
      socket.emit('dm:typing:start', {
        senderId: state.user.id,
        receiverId: state.currentDM,
        displayName: state.user.display_name
      });
      
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('dm:typing:stop', {
          senderId: state.user.id,
          receiverId: state.currentDM
        });
      }, 2000);
    }
  });
  
  // Create channel
  document.getElementById('create-channel-btn').addEventListener('click', () => {
    elements.channelModal.classList.add('active');
  });
  
  document.getElementById('create-channel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('channel-name-input').value;
    const description = document.getElementById('channel-desc-input').value;
    
    const result = await api.post('/api/channels', {
      name,
      description,
      userId: state.user.id
    });
    
    if (result.error) {
      alert(result.error);
      return;
    }
    
    elements.channelModal.classList.remove('active');
    document.getElementById('create-channel-form').reset();
    
    await loadChannels();
    selectChannel(result);
  });
  
  // View members
  document.getElementById('channel-members-btn').addEventListener('click', async () => {
    if (!state.currentChannel) return;
    
    const members = await loadChannelMembers(state.currentChannel.id);
    renderMembersList(members);
    elements.membersModal.classList.add('active');
  });
  
  // Modal close
  document.querySelectorAll('.modal-backdrop, .modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
  });
  
  // User menu
  document.getElementById('user-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    elements.userMenu.style.display = elements.userMenu.style.display === 'none' ? 'block' : 'none';
  });
  
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  document.addEventListener('click', (e) => {
    if (!elements.userMenu.contains(e.target) && !e.target.closest('#user-menu-btn')) {
      elements.userMenu.style.display = 'none';
    }
    if (!elements.emojiPicker.contains(e.target) && !e.target.closest('#emoji-btn')) {
      elements.emojiPicker.style.display = 'none';
    }
  });
  
  // Emoji picker
  document.getElementById('emoji-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    elements.emojiPicker.style.display = elements.emojiPicker.style.display === 'none' ? 'block' : 'none';
  });
  
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.messageInput.value += btn.textContent;
      elements.messageInput.focus();
      elements.emojiPicker.style.display = 'none';
    });
  });
  
  // Message actions
  elements.messagesContainer.addEventListener('click', async (e) => {
    const message = e.target.closest('.message');
    if (!message) return;
    
    const messageId = message.dataset.messageId;
    
    // Delete message
    if (e.target.closest('.delete-message-btn')) {
      if (confirm('Delete this message?')) {
        await api.delete(`/api/messages/${messageId}`);
      }
      return;
    }
    
    // Add reaction button
    if (e.target.closest('.add-reaction-btn')) {
      // Simple emoji selection
      const emojis = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];
      const emoji = prompt('Pick an emoji:\n' + emojis.join(' '));
      if (emoji && emoji.trim()) {
        await api.post(`/api/messages/${messageId}/reactions`, {
          userId: state.user.id,
          emoji: emoji.trim()
        });
      }
      return;
    }
    
    // Toggle reaction
    const reactionBtn = e.target.closest('.reaction');
    if (reactionBtn) {
      const emoji = reactionBtn.dataset.emoji;
      const isMine = reactionBtn.classList.contains('mine');
      
      if (isMine) {
        await api.delete(`/api/messages/${messageId}/reactions`, {
          userId: state.user.id,
          emoji
        });
      } else {
        await api.post(`/api/messages/${messageId}/reactions`, {
          userId: state.user.id,
          emoji
        });
      }
    }
  });
  
  // Search
  const searchDebounced = debounce(async (query) => {
    if (!query.trim()) {
      elements.searchResults.innerHTML = '<p class="search-hint">Enter a search term to find messages across all channels</p>';
      return;
    }
    
    const results = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
    renderSearchResults(results);
  }, 300);
  
  elements.searchInput.addEventListener('input', (e) => {
    searchDebounced(e.target.value);
  });
  
  // Click search result to go to channel
  elements.searchResults.addEventListener('click', async (e) => {
    const resultItem = e.target.closest('.search-result-item');
    if (resultItem) {
      const channelId = resultItem.dataset.channelId;
      const channel = state.channels.find(c => c.id === channelId);
      if (channel) {
        switchView('channels');
        await selectChannel(channel);
      }
    }
  });
}

function switchView(view) {
  state.view = view;
  
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // Show/hide sidebars
  elements.channelsSidebar.style.display = view === 'channels' ? '' : 'none';
  elements.dmsSidebar.style.display = view === 'dms' ? '' : 'none';
  elements.searchSidebar.style.display = view === 'search' ? '' : 'none';
  
  // Load DM conversations if switching to DMs
  if (view === 'dms') {
    loadDMConversations();
  }
}

async function loadDMConversations() {
  const conversations = await api.get(`/api/dm/conversations?userId=${state.user.id}`);
  renderDMList(conversations);
}

async function sendMessage() {
  const content = elements.messageInput.value.trim();
  if (!content) return;
  
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  
  if (state.view === 'channels' && state.currentChannel) {
    // Stop typing indicator
    socket.emit('typing:stop', {
      channelId: state.currentChannel.id,
      userId: state.user.id
    });
    
    await api.post(`/api/channels/${state.currentChannel.id}/messages`, {
      userId: state.user.id,
      content
    });
  } else if (state.view === 'dms' && state.currentDM) {
    // Stop typing indicator
    socket.emit('dm:typing:stop', {
      senderId: state.user.id,
      receiverId: state.currentDM
    });
    
    await api.post('/api/dm', {
      senderId: state.user.id,
      receiverId: state.currentDM,
      content
    });
    
    // Refresh DM list
    loadDMConversations();
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  
  // Check for saved session
  const savedUser = localStorage.getItem('slack-user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      // Verify user still exists
      api.get(`/api/users/${user.id}`).then(result => {
        if (result && !result.error) {
          loginSuccess(result);
        }
      });
    } catch (e) {
      localStorage.removeItem('slack-user');
    }
  }
});
