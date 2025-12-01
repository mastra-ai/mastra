# Pulse - Real-Time Team Messaging

A beautiful, real-time messaging application inspired by Slack, built with Node.js and vanilla JavaScript.

![Pulse Messaging](https://via.placeholder.com/800x400/1a1128/8b5cf6?text=Pulse+Messaging)

## Features

### 💬 Real-Time Messaging
- Instant message delivery with Socket.io
- Typing indicators show when others are composing messages
- Message formatting with markdown-like syntax (bold, italic, code)
- Edit and delete your own messages

### 📢 Channels
- Create public channels for team discussions
- Default channels: #general, #random, #announcements
- Join/leave channels freely
- View channel members

### 💌 Direct Messages
- Private 1-on-1 conversations
- See online/offline status
- Quick access to recent conversations

### 😀 Reactions
- React to messages with emojis
- Toggle reactions on/off
- See who reacted to each message

### 🔍 Search
- Search across all channels
- Find messages by content
- Click results to jump to that channel

### 👤 User Features
- User registration and login
- Custom display names
- Colorful auto-generated avatars
- Online/offline status tracking

## Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: Vanilla JavaScript, CSS3
- **Authentication**: bcryptjs for password hashing

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or pnpm

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd slack-clone
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

## Usage

### Creating an Account

1. Click "Create Account" on the login screen
2. Choose a username (3-20 characters)
3. Enter your display name
4. Create a password (6+ characters)
5. Click "Create Account"

### Sending Messages

1. Select a channel from the sidebar
2. Type your message in the input field
3. Press Enter or click the send button
4. Use markdown for formatting:
   - `**bold**` for **bold**
   - `*italic*` for *italic*
   - `` `code` `` for `code`

### Creating Channels

1. Click the + button next to "Channels"
2. Enter a channel name (lowercase, no spaces)
3. Add an optional description
4. Click "Create Channel"

### Direct Messages

1. Click the chat bubble icon in the left sidebar
2. Select a user to message
3. Or click on any online user to start a conversation

### Reactions

1. Hover over any message
2. Click the emoji button
3. Enter an emoji to react
4. Click an existing reaction to toggle it

## Project Structure

```
slack-clone/
├── public/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # All styles
│   └── app.js          # Frontend JavaScript
├── src/
│   ├── server.js       # Express server & Socket.io
│   └── database.js     # SQLite database layer
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user profile

### Channels
- `GET /api/channels` - Get all public channels
- `POST /api/channels` - Create new channel
- `GET /api/channels/:id` - Get channel details
- `GET /api/channels/:id/members` - Get channel members
- `POST /api/channels/:id/join` - Join channel
- `POST /api/channels/:id/leave` - Leave channel

### Messages
- `GET /api/channels/:id/messages` - Get channel messages
- `POST /api/channels/:id/messages` - Send message
- `PATCH /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

### Reactions
- `POST /api/messages/:id/reactions` - Add reaction
- `DELETE /api/messages/:id/reactions` - Remove reaction

### Direct Messages
- `GET /api/dm/conversations` - Get DM conversations
- `GET /api/dm/:userId1/:userId2` - Get DM history
- `POST /api/dm` - Send direct message

### Search
- `GET /api/search?q=query` - Search messages

## Socket Events

### Client → Server
- `user:connect` - Authenticate connection
- `channel:join` - Join channel room
- `channel:leave` - Leave channel room
- `typing:start` - User started typing
- `typing:stop` - User stopped typing

### Server → Client
- `message:new` - New message received
- `message:updated` - Message was edited
- `message:deleted` - Message was deleted
- `message:reactions_updated` - Reactions changed
- `channel:created` - New channel created
- `user:status_changed` - User online/offline
- `typing:start` - Someone is typing
- `typing:stop` - Someone stopped typing

## Design Features

- **Dark Theme**: Beautiful purple-tinted dark interface
- **Gradient Accents**: Indigo to pink gradient highlights
- **Smooth Animations**: Subtle transitions and hover effects
- **Responsive Layout**: Adapts to different screen sizes
- **Modern Typography**: DM Sans font with JetBrains Mono for code

## Contributing

Feel free to submit issues and pull requests to improve the application!

## License

MIT License - feel free to use this project for any purpose.

---

Built with ❤️ using Node.js and Socket.io
