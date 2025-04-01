# Mastra Memory FAQ

This FAQ addresses common questions about Mastra Memory based on real user feedback.

## Basics

### What is Mastra Memory? How does it relate to the LLM context window?

Memory in Mastra refers to the system that manages the context window for your LLM. It stores previous conversations and relevant information, then retrieves and injects this context during new interactions. This allows your agents to "remember" previous interactions without manually managing context.

### Do I need to explicitly configure Memory for my agent to remember conversations?

Yes. By default, agents do not use memory. You need to:
1. Install `@mastra/memory`
2. Create a Memory instance
3. Attach it to your agent
4. Pass `resourceId` and `threadId` parameters when calling the agent

```typescript
import { Memory } from "@mastra/memory";

// Create memory
const memory = new Memory();

// Add to agent
const agent = new Agent({
  name: "MemoryAgent",
  memory,
  // other options
});

// Use with IDs
await agent.stream("Hello", {
  resourceId: "user_123",
  threadId: "conversation_456",
});
```

## Resource and Thread IDs

### Why do I need both resourceId and threadId? Isn't threadId enough?

Both IDs serve different purposes:
- `resourceId` identifies the owner/entity (typically a user)
- `threadId` identifies a specific conversation thread

This structure allows a single user to have multiple separate conversations. Both are required because:
1. Memory is segmented by both IDs for proper organization
2. Access control requires knowing which resource owns each thread
3. Working memory is associated with specific resource-thread combinations

### How should I structure my resourceId and threadId values?

Follow these best practices:
- `resourceId`: Use format like `user_123` or `customer_abc` to identify the entity type and ID
- `threadId`: Use a unique ID per conversation, like UUIDs
- Be consistent with your format throughout your application

### If I use the same threadId and resourceId with two different agents, will they share memory?

Yes. Using the same IDs will make both agents access the same conversation history. This is useful when you want agents to collaborate or have continuity.

If you want separate memory for each agent, use a different threadId for each, such as `${baseThreadId}_${agentName}`.

## Working Memory

### Is working memory shared between different agent instances?

Working memory is scoped to a resource-thread combination, not to an agent. Any agent using the same `resourceId` and `threadId` will access the same working memory content.

This means you can have different agents handle different parts of a conversation while maintaining shared working memory state.

### Why doesn't my agent follow the XML template structure I provided for working memory?

The template is a suggestion to guide the agent, not a strict schema. LLMs may deviate from the exact structure, especially if they don't have clear instructions about how to use it.

For better adherence:
1. Add explicit instructions in your agent prompt about updating working memory
2. Use the newer `use: "tool-call"` option instead of the default text stream mode
3. Consider adding system instructions like: "When you learn information about the user, store it in working memory using the exact XML structure provided"

## Frontend Integration

### Why am I getting duplicate messages when using useChat with memory?

By default, `useChat` sends the entire message history with each request, which can cause duplication in memory. To fix this:

```typescript
const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: "/api/chat",
  experimental_prepareRequestBody({ messages, id }) {
    // Only send the latest message
    return { message: messages.at(-1), id, threadId, resourceId };
  },
});
```

### How do I integrate Mastra Memory with Next.js?

Here's a simplified approach:
1. Configure memory with a database backend appropriate for your deployment (PostgreSQL recommended for production)
2. Create a Next.js API route that handles chat requests
3. In that route, pass the user's ID as resourceId and the conversation ID as threadId
4. Use `experimental_prepareRequestBody` with useChat to send only the latest message

See our [Frontend example](./new-docs/examples/frontend.md) for complete code.

## Database Configuration

### How do I configure Mastra Memory for production with PostgreSQL?

Install the PostgreSQL adapter:
```bash
npm install @mastra/pg
```

Then configure memory:
```typescript
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL,
    pool: {
      max: 20, // Adjust based on your environment
    },
  }),
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL,
  }),
});
```

Ensure your Postgres database has the pgvector extension installed.

### Should I exclude memory.db from my Git repository?

Yes. The default LibSQL database (memory.db) is for development only and should be added to your .gitignore file.

For production, you should use a proper database:
- PostgreSQL (with @mastra/pg)
- Upstash Redis (with @mastra/upstash)
- Other supported databases

## Deployment

### How do I deploy a memory-enabled app to Vercel without hitting serverless function limits?

Memory can increase function size and memory usage. To deploy on Vercel:

1. Use an external database (not the default LibSQL)
2. Use a cloud-based embedder to reduce bundle size:
   ```typescript
   import { openai } from "@ai-sdk/openai";
   
   const memory = new Memory({
     embedder: openai.embedding("text-embedding-3-small"),
     // Other options
   });
   ```
3. Configure proper connection pooling for PostgreSQL:
   ```typescript
   pool: {
     max: 10, // Lower for serverless
     idleTimeoutMs: 10000,
   }
   ```
4. Consider splitting memory-heavy operations into separate functions

### What changes do I need to make when deploying from local development to production?

Here's a transition checklist:

1. Switch from LibSQL to a production database:
   ```typescript
   const memory = new Memory({
     ...(process.env.NODE_ENV === "development" 
       ? {} // Default LibSQL for development
       : {
           // Production configuration
           storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
           vector: new PgVector({ connectionString: process.env.DATABASE_URL }),
           embedder: openai.embedding("text-embedding-3-small"),
         }
     ),
   });
   ```

2. Set up proper connection pooling for your environment
3. Configure environment variables for your production database
4. Consider data migration if you've built up development data you want to keep

## Multiple Agents

### Should I create one Memory instance per agent or share a single instance?

It depends on your use case:

- **Share a Memory instance** when:
  - Multiple agents need to collaborate on the same conversation
  - You want continuity between different agent interactions
  - Agents are part of the same workflow

- **Use separate Memory instances** when:
  - Agents serve completely different purposes
  - You want to isolate memory between systems
  - You have different storage requirements for each agent

### How can I make multiple agents work together using the same memory?

To share memory between agents:

1. Create a single Memory instance
2. Attach it to multiple agents
3. Use the same resourceId and threadId when calling each agent

```typescript
const memory = new Memory();

const agentA = new Agent({
  name: "AgentA",
  memory,
  // other options
});

const agentB = new Agent({
  name: "AgentB",
  memory,
  // other options
});

// Both agents will now share memory when using the same IDs
await agentA.stream("Message for agent A", {
  resourceId: "user_123",
  threadId: "thread_456",
});

await agentB.stream("Message for agent B", {
  resourceId: "user_123",
  threadId: "thread_456",
});
```

## Troubleshooting

### Why does my memory work locally but fails when deployed?

Common deployment issues include:

1. **Database connectivity**: Ensure your database connection string is correct and the database is accessible from your deployment environment
2. **Embedder issues**: The default FastEmbed uses local file access which doesn't work in serverless environments - switch to a cloud embedder
3. **Connection limits**: Serverless platforms may have connection limits - use appropriate connection pooling
4. **Memory/CPU limits**: Reduce context sizes or optimize database queries if hitting resource limits

### I'm getting "LlamaIndex was already imported. This breaks constructor checks" errors. How do I fix this?

This typically happens due to package manager issues. Try:

1. Switch to pnpm:
   ```
   pnpm install @mastra/memory
   ```
2. If you can't switch package managers, try clearing your node_modules and reinstalling:
   ```
   rm -rf node_modules
   npm install
   ```
3. Make sure you don't have duplicate installations of dependencies 