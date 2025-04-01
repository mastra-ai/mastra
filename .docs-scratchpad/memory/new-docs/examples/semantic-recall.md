# Semantic Recall Example

This example demonstrates how to use Mastra's semantic search capabilities to find and retrieve relevant messages from past conversations, even when they occurred many messages ago.

## Implementation

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { PostgresStore, PgVector } from "@mastra/pg";
import fs from "fs";

async function main() {
  // Create a memory instance with vector search capabilities
  const memory = new Memory({
    // Use PostgreSQL for storage and vector search
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/mastra",
    }),
    vector: new PgVector(process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/mastra"),
    
    // Configure semantic recall options
    options: {
      semanticRecall: {
        topK: 3,           // Retrieve 3 most relevant messages
        messageRange: 1,   // Include 1 message before and after each match
      },
    },
  });

  // Create an agent with memory
  const agent = new Agent({
    name: "ProjectManager",
    instructions: "You are a project management assistant that helps with software development projects.",
    model: openai("gpt-4o"),
    memory: memory,
  });

  // Set up conversation identifiers
  const resourceId = "example_developer";
  const threadId = "project_management";

  // First, let's have a conversation about project requirements
  console.log("\n--- Setting Project Requirements ---");
  
  await runConversationTurn(
    agent,
    "I need to build a web application for inventory management. It should have user authentication, product catalog, inventory tracking, and reporting features.",
    resourceId,
    threadId
  );
  
  await runConversationTurn(
    agent,
    "For the tech stack, I'm thinking of using React for the frontend, Node.js with Express for the backend, and PostgreSQL for the database.",
    resourceId,
    threadId
  );
  
  await runConversationTurn(
    agent,
    "We need to ensure the application is responsive and works well on mobile devices.",
    resourceId,
    threadId
  );

  // Now let's have several conversations about unrelated topics
  console.log("\n--- Discussing Other Topics ---");
  
  // Add 10 messages about unrelated topics to dilute the conversation
  for (let i = 0; i < 10; i++) {
    const topics = [
      "What's the weather like today?",
      "Can you recommend a good book to read?",
      "Tell me about the history of programming languages.",
      "What's your favorite movie?",
      "How does machine learning work?",
    ];
    
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    await runConversationTurn(agent, randomTopic, resourceId, threadId);
  }

  // Now, ask a question that requires semantic recall of the earlier project requirements
  console.log("\n--- Semantic Recall Test ---");
  console.log("User: What database technology did we decide to use for our inventory project?");
  
  const response = await agent.stream(
    "What database technology did we decide to use for our inventory project?",
    {
      resourceId,
      threadId,
      // We could override semantic recall settings here, but we'll use the defaults
    }
  );

  console.log("Assistant: ");
  for await (const chunk of response.textStream) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Let's examine what messages were retrieved by semantic search
  console.log("\n--- Debug: Retrieved Messages ---");
  const { messages } = await memory.query({
    threadId,
    selectBy: {
      vectorSearchString: "database technology inventory project",
    },
    debug: true, // Enable debug output
  });

  console.log(`Semantic search found ${messages.length} relevant messages.`);
  fs.writeFileSync("semantic-recall-results.json", JSON.stringify(messages, null, 2));
  console.log("Semantic search results written to semantic-recall-results.json");
}

// Helper function to run a conversation turn
async function runConversationTurn(agent, message, resourceId, threadId) {
  console.log(`User: ${message}`);
  
  const response = await agent.stream(message, {
    resourceId,
    threadId,
  });

  console.log("Assistant: ");
  for await (const chunk of response.textStream) {
    process.stdout.write(chunk);
  }
  console.log("\n");
}

main().catch(console.error);
```

## Expected Output

```
--- Setting Project Requirements ---
User: I need to build a web application for inventory management. It should have user authentication, product catalog, inventory tracking, and reporting features.
Assistant: That sounds like a comprehensive inventory management web application. Let's break down the features you've mentioned:

1. User Authentication:
   - Login/logout functionality
   - User roles (admin, manager, staff)
   - Password recovery
   - Access control based on roles

2. Product Catalog:
   - Product listings with details
   - Categories and tags
   - Search and filter options
   - Product images and descriptions

3. Inventory Tracking:
   - Stock levels
   - Low stock alerts
   - Inventory adjustments
   - Batch/lot tracking
   - Supplier information

4. Reporting Features:
   - Inventory valuation reports
   - Stock movement reports
   - Sales and procurement analytics
   - Custom report generation
   - Export options (CSV, PDF)

Would you like to discuss the technology stack for this project? Or would you prefer to elaborate on any specific feature from the ones you've mentioned?

User: For the tech stack, I'm thinking of using React for the frontend, Node.js with Express for the backend, and PostgreSQL for the database.
Assistant: That's an excellent tech stack choice for your inventory management application! Let me break down why each component works well:

React (Frontend):
- Perfect for building dynamic, responsive UIs
- Component-based architecture for reusable UI elements
- Large ecosystem of libraries for features like tables, charts, and forms
- React Router for navigation between different sections
- State management options like Redux or Context API for complex state

Node.js with Express (Backend):
- JavaScript across the full stack simplifies development
- Express provides robust routing and middleware support
- Excellent for building RESTful APIs
- Async/non-blocking for handling multiple concurrent requests
- Good performance for data processing operations

PostgreSQL (Database):
- Robust relational database perfect for inventory data
- Excellent for complex queries and reporting
- Strong data integrity with transactions and constraints
- JSON support for flexible data structures when needed
- Good performance with proper indexing

Additional technologies you might consider:
- TypeScript for type safety across your application
- Prisma or Sequelize as an ORM for database interactions
- JWT for authentication
- Socket.IO for real-time notifications
- Material UI or Tailwind CSS for the frontend styling

Is there a particular area of this stack you'd like to explore in more detail?

User: We need to ensure the application is responsive and works well on mobile devices.
Assistant: Absolutely, making your inventory management application responsive and mobile-friendly is essential for modern usage. Here's how you can achieve that with your chosen tech stack:

For React Frontend:
1. **Responsive Design Approaches**:
   - Utilize CSS media queries for different screen sizes
   - Implement responsive grid layouts with CSS Grid or Flexbox
   - Consider a "mobile-first" design approach
   - Use relative units (%, rem, em) instead of fixed pixels

2. **UI Component Libraries with Mobile Support**:
   - Material-UI has excellent responsive components
   - Chakra UI provides mobile-friendly components out of the box
   - React Bootstrap or Tailwind CSS offer responsive grid systems
   - Ant Design has strong mobile support

3. **Responsive Testing Tools**:
   - React Developer Tools for component inspection
   - Chrome/Firefox DevTools mobile device emulation
   - Actual device testing on various screen sizes
   - Responsive testing tools like Responsively App

4. **Performance Considerations**:
   - Optimize images and assets for mobile
   - Implement code splitting to reduce bundle size
   - Consider lazy loading for non-critical components
   - Use service workers for offline capabilities

5. **Mobile-Specific Features**:
   - Implement touch-friendly UI elements (larger buttons, swipe gestures)
   - Consider a Progressive Web App (PWA) approach
   - Optimize forms for mobile input
   - Ensure readable typography on small screens

6. **Testing Methodology**:
   - Regular testing across different devices and browsers
   - Automated testing with viewport simulation
   - User testing with actual mobile devices

Would you like me to elaborate on any specific aspect of mobile responsiveness? Or perhaps discuss how to implement particular mobile-friendly features for your inventory management system?

--- Discussing Other Topics ---
User: What's the weather like today?
Assistant: I don't have the ability to check the current weather in your location as I don't have access to real-time weather data or your location information. To get accurate weather information, you could:

1. Check a weather website or app like Weather.com, AccuWeather, or your local meteorological service
2. Ask a virtual assistant with weather capabilities like Siri, Google Assistant, or Alexa
3. Look outside your window for a firsthand observation

If you'd like to discuss weather APIs that you could integrate into your inventory management application (perhaps for logistics planning), I'd be happy to suggest some options!

[... 9 more unrelated conversation turns ...]

--- Semantic Recall Test ---
User: What database technology did we decide to use for our inventory project?
Assistant: For your inventory management project, you decided to use PostgreSQL as the database technology. This was part of your tech stack along with React for the frontend and Node.js with Express for the backend.

PostgreSQL is a good choice for an inventory management system because it's a robust relational database that provides strong data integrity, supports complex queries (which will be useful for your reporting features), and can handle the relationships between products, inventory, users, and other entities in your system.

--- Debug: Retrieved Messages ---
Semantic search found 7 relevant messages.
Semantic search results written to semantic-recall-results.json
```

## How It Works

1. **Vector Database Setup**: We configure a PostgreSQL database for both regular storage and vector search.
2. **Semantic Recall Configuration**: We set `topK: 3` to find the three most relevant messages and `messageRange: 1` to include context around matches.
3. **Initial Conversation**: We discuss project requirements, including the choice of PostgreSQL.
4. **Context Dilution**: We add many unrelated messages to push the database discussion far back in the conversation history.
5. **Semantic Recall**: When we ask about the database technology, the agent uses semantic search to find the relevant message mentioning PostgreSQL, even though it was many messages ago.
6. **Debug Output**: We explicitly run a semantic search to see which messages were retrieved.

## Key Points

- Semantic recall finds relevant messages based on meaning, not just recency
- Multiple unrelated messages don't prevent the agent from finding earlier context
- The `vectorSearchString` parameter lets you explicitly search for relevant information
- Adjusting `topK` and `messageRange` controls how much context is retrieved

## Variations

### Using Different Vector Databases

```typescript
// Using Chroma for vector search
import { ChromaVector } from "@mastra/chroma";

const memory = new Memory({
  vector: new ChromaVector({
    url: "http://localhost:8000",
    collectionName: "mastra_memory",
  }),
});

// Using Pinecone for vector search
import { PineconeVector } from "@mastra/pinecone";

const memory = new Memory({
  vector: new PineconeVector({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    index: "mastra-memory",
  }),
});
```

### Using Different Embedding Models

```typescript
import { openai } from "@ai-sdk/openai";
import { cohere } from "@ai-sdk/cohere";

// Using OpenAI embeddings
const memory = new Memory({
  embedder: openai.embedding("text-embedding-3-small"),
});

// Using Cohere embeddings
const memory = new Memory({
  embedder: cohere.embedding("embed-english-v3.0"),
});
```

### Customizing Semantic Recall Per Request

```typescript
// Override semantic recall settings for a specific query
const response = await agent.stream("How does our authentication system work?", {
  resourceId,
  threadId,
  memoryOptions: {
    semanticRecall: {
      topK: 5,         // Get more semantic matches for this complex topic
      messageRange: {  // Asymmetric context
        before: 1,     // Include 1 message before each match
        after: 3,      // Include 3 messages after each match
      },
    },
  },
});
```

## Related Examples

- [Basic Conversation Example](./conversation.md): Simple conversation with memory
- [Working Memory Example](./working-memory.md): Maintaining persistent user information 