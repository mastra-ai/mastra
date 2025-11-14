# Per-Resource Working Memory Example

This example demonstrates **resource-scoped working memory** in Mastra, where working memory persists across all conversation threads for the same user (resourceId).

## 📖 Overview

### Resource-Scoped Working Memory (Default)

- **Resource-scoped** (default): Working memory is stored per-resource (user) and persists across ALL conversation threads
- **Thread-scoped** (optional): Working memory can be isolated per-thread by setting `scope: 'thread'`

### Key Benefits

- 🧠 **Persistent user profiles**: Remember user preferences, goals, and context across sessions
- 🔄 **Cross-conversation continuity**: Start new conversations where you left off
- 👥 **Multi-user support**: Separate memory for each user while sharing across their threads
- 📈 **Progressive learning**: Build richer user profiles over time

## 🚀 How to Run

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set up environment**:

   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

3. **Run the example**:
   ```bash
   pnpm dev
   ```

## 🎯 How to Test Per-Resource Memory

### Test 1: Same User, Different Threads

1. Run the example and choose "Alice" (option 1)
2. Introduce yourself and share some interests
3. Exit the conversation
4. **Run the example again** and choose "Alice" again
5. 🎉 **Result**: The agent remembers you from the previous conversation!

### Test 2: Different Users

1. Run the example and choose "Alice" (option 1)
2. Have a conversation and share some info
3. Exit and run the example again, but choose "Bob" (option 2)
4. 🎉 **Result**: The agent treats Bob as a new user (separate memory)

### Test 3: Progressive Learning

1. Have multiple conversations with the same user across different sessions
2. Notice how the agent builds a richer profile over time
3. 🎉 **Result**: Each conversation adds to the user's persistent profile

## 🔧 Configuration

### Resource-Scoped Working Memory Setup

```typescript
const memory = new Memory({
  storage, // Persistent storage required (LibSQL, PostgreSQL, or Upstash)
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource', // 🆕 NEW: Per-resource instead of per-thread
      template: `# User Profile
- **Name**: 
- **Interests**: 
- **Preferences**: 
`,
    },
  },
});
```

### Supported Storage Adapters

The following storage adapters support per-resource working memory:

- ✅ **LibSQL** (`@mastra/libsql`)
- ✅ **PostgreSQL** (`@mastra/pg`)
- ✅ **Upstash** (`@mastra/upstash`)
- ❌ **MockStore** (in-memory only, for testing)

## 💡 Use Cases

### Personal Assistant

- Remember user preferences, goals, and context
- Provide personalized recommendations across sessions
- Track progress on long-term projects

### Customer Support

- Maintain customer history and preferences
- Provide consistent service across different support sessions
- Remember previous issues and resolutions

### Educational Tutor

- Track student progress and learning style
- Adapt teaching approach based on past interactions
- Remember strengths and areas for improvement

### Healthcare Assistant

- Maintain patient context and medical history
- Remember treatment preferences and concerns
- Provide continuity of care across appointments

## 🆚 Comparison: Thread vs Resource Scope

| Feature                | Thread Scope               | Resource Scope               |
| ---------------------- | -------------------------- | ---------------------------- |
| **Memory Persistence** | Single conversation thread | All threads for same user    |
| **Use Case**           | Session-specific context   | Long-term user relationships |
| **Storage**            | Any storage adapter        | LibSQL, PostgreSQL, Upstash  |
| **User Experience**    | Fresh start each thread    | Continuous relationship      |
| **Data Isolation**     | Per thread                 | Per user (resourceId)        |

## 🔍 Behind the Scenes

### How It Works

1. **Resource Identification**: Each user is identified by a unique `resourceId`
2. **Persistent Storage**: Working memory is stored in a dedicated `resources` table
3. **Cross-Thread Access**: All threads with the same `resourceId` share working memory
4. **Automatic Updates**: Working memory updates are saved immediately and available across threads

### Database Schema

```sql
CREATE TABLE mastra_resources (
  id TEXT PRIMARY KEY,           -- resourceId (user identifier)
  workingMemory TEXT,           -- JSON working memory data
  metadata JSONB,               -- Additional metadata
  createdAt TIMESTAMP,          -- Creation time
  updatedAt TIMESTAMP           -- Last update time
);
```

## 🎨 Customization

### Custom Templates

```typescript
workingMemory: {
  enabled: true,
  scope: 'resource',
  template: `# Customer Profile
- **Name**:
- **Company**:
- **Industry**:
- **Pain Points**:
- **Previous Purchases**:
- **Communication Preferences**:
`,
}
```

### Custom Instructions

```typescript
instructions: `You are a sales assistant with persistent memory.

🆕 IMPORTANT: You have resource-scoped working memory that persists 
across ALL conversations with this customer. Use this to:
- Build long-term customer relationships
- Remember their business needs and preferences
- Track the sales process across multiple touchpoints
- Provide personalized service

Always update your working memory with new information about the customer.`;
```
