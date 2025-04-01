# Authentication Example with Memory Threads

This example demonstrates how to build a secure, authenticated application with Mastra Memory using JWT authentication and proper thread access control.

## Overview

We'll implement:
- JWT-based authentication
- Secure memory thread access
- User-specific thread management
- Authentication middleware for memory endpoints

## Project Structure

```
/src
  /auth
    /jwt.ts               # JWT utilities
    /middleware.ts        # Authentication middleware
  /mastra
    /index.ts             # Mastra instance setup
    /agent.ts             # Agent configuration
  /api
    /chat.ts              # Protected chat endpoint
    /threads.ts           # Thread management endpoints
```

## Step 1: JWT Authentication Utilities

First, let's create JWT utilities for handling authentication:

```typescript
// src/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '24h';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): User | null {
  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch (error) {
    return null;
  }
}
```

## Step 2: Authentication Middleware

Create middleware to protect routes and manage thread access:

```typescript
// src/auth/middleware.ts
import { Hono } from 'hono';
import { verifyToken, User } from './jwt';
import { memory } from '../mastra';

// Authenticate user from JWT token
export function authMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    
    if (!user) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    
    // Attach user to context
    c.set('user', user);
    await next();
  };
}

// Ensure user has access to the thread
export function threadAccessMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const user = c.get('user') as User;
    const threadId = c.req.param('threadId');
    
    // Get thread from memory
    const thread = await memory.getThreadById({ threadId });
    
    // Check if thread exists and belongs to user
    if (!thread || thread.resourceId !== `user_${user.id}`) {
      return c.json({ error: 'Thread not found or access denied' }, 404);
    }
    
    c.set('thread', thread);
    await next();
  };
}
```

## Step 3: Mastra Setup with Memory

Configure Mastra with memory:

```typescript
// src/mastra/agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';

// Configure memory with PostgreSQL
export const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL!,
  }),
  embedder: openai.embedding('text-embedding-3-small'),
  options: {
    workingMemory: {
      enabled: true,
      use: 'tool-call',
    },
  },
});

// Create agent with memory
export const chatAgent = new Agent({
  name: 'SupportAgent',
  instructions: 'You provide secure customer support.',
  model: openai('gpt-4o'),
  memory,
});
```

## Step 4: Protected API Routes

Configure API routes with authentication:

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { authMiddleware, threadAccessMiddleware } from '../auth/middleware';
import { chatAgent, memory } from './agent';

export const mastra = new Mastra({
  agents: {
    supportAgent: chatAgent,
  },
  server: {
    apiRoutes: [
      // Chat endpoint
      registerApiRoute('/api/chat', {
        method: 'POST',
        middleware: [authMiddleware()],
        handler: async (c) => {
          const user = c.get('user');
          const { message, threadId } = await c.req.json();
          
          // Use user ID as resource ID
          const resourceId = `user_${user.id}`;
          
          // Stream response with memory
          const stream = await chatAgent.stream(message, {
            resourceId,
            threadId: threadId || crypto.randomUUID(),
          });
          
          return stream.toDataStreamResponse();
        },
      }),
      
      // Get threads for user
      registerApiRoute('/api/threads', {
        method: 'GET',
        middleware: [authMiddleware()],
        handler: async (c) => {
          const user = c.get('user');
          const resourceId = `user_${user.id}`;
          
          const threads = await memory.getThreadsByResourceId({ resourceId });
          
          return c.json(threads);
        },
      }),
      
      // Get specific thread (with access control)
      registerApiRoute('/api/threads/:threadId', {
        method: 'GET',
        middleware: [authMiddleware(), threadAccessMiddleware()],
        handler: async (c) => {
          const thread = c.get('thread');
          
          // Get thread messages
          const { messages } = await memory.query({
            threadId: thread.id,
            selectBy: { last: 50 },
          });
          
          return c.json({ thread, messages });
        },
      }),
      
      // Create new thread
      registerApiRoute('/api/threads', {
        method: 'POST',
        middleware: [authMiddleware()],
        handler: async (c) => {
          const user = c.get('user');
          const { title } = await c.req.json();
          
          const thread = await memory.createThread({
            resourceId: `user_${user.id}`,
            title: title || 'New Conversation',
          });
          
          return c.json(thread);
        },
      }),
    ],
  },
});
```

## Step 5: Authentication Example

Here's a complete login/authentication flow:

```typescript
// src/api/auth.ts
import { User, generateToken } from '../auth/jwt';
import { registerApiRoute } from '@mastra/core/server';

// Mock user database (replace with real DB)
const USERS = {
  'user@example.com': {
    id: '123',
    email: 'user@example.com',
    password: 'password123', // Use proper hashing in production!
    name: 'Test User',
    role: 'user' as const,
  },
};

export const authRoutes = [
  // Login endpoint
  registerApiRoute('/api/auth/login', {
    method: 'POST',
    handler: async (c) => {
      const { email, password } = await c.req.json();
      
      // Find user (use proper password comparison in production)
      const user = USERS[email];
      if (!user || user.password !== password) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }
      
      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      
      return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    },
  }),
];
```

## Step 6: Client-Side Auth Integration

Integrate authentication on the client side:

```typescript
// Example React component using auth with memory
import { useState, useEffect } from 'react';

export function ChatWithAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [threadId, setThreadId] = useState(localStorage.getItem('threadId'));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  // Login function
  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
  };
  
  // Send message function
  const sendMessage = async () => {
    if (!token || !input.trim()) return;
    
    // Create thread if needed
    if (!threadId) {
      const thread = await createThread();
      setThreadId(thread.id);
      localStorage.setItem('threadId', thread.id);
    }
    
    // Add user message to UI
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Send to API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: input,
        threadId,
      }),
    });
    
    // Process streaming response
    if (response.ok) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botMessage = { role: 'assistant', content: '' };
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        botMessage.content += chunk;
        
        // Update the last message
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...prev[prev.length - 1], content: botMessage.content },
        ]);
      }
    }
    
    setInput('');
  };
  
  // Create a new thread
  const createThread = async () => {
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title: 'Support Chat' }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    throw new Error('Failed to create thread');
  };
  
  return (
    <div>
      {!token ? (
        // Login form
        <div>
          <h2>Login</h2>
          <form onSubmit={e => {
            e.preventDefault();
            login(e.target.email.value, e.target.password.value);
          }}>
            <input name="email" placeholder="Email" />
            <input name="password" type="password" placeholder="Password" />
            <button type="submit">Login</button>
          </form>
        </div>
      ) : (
        // Chat interface
        <div>
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>
          <div className="input-area">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Security Best Practices

1. **Secure Token Storage**: Use secure HttpOnly cookies for tokens rather than localStorage in production

2. **Thread Access Verification**: Always check thread ownership before allowing access

3. **Input Validation**: Validate all inputs on server side

4. **Proper Error Handling**: Return consistent error types without leaking implementation details

5. **Rate Limiting**: Add rate limiting to prevent abuse of memory storage

6. **Use MFA**: Consider adding multi-factor authentication for sensitive applications

## Related Documentation

- [Authentication with Memory](../4-memory-threads/4.5-auth.md)
- [Memory Threads](../4-memory-threads/index.md)
- [Multiple Users](../4-memory-threads/4.3-multiple-users.md) 