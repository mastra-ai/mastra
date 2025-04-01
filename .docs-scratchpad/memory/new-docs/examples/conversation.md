# Basic Conversation Example

This example demonstrates a simple conversation with memory, showing how Mastra maintains context across multiple turns.

## Implementation

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import fs from "fs";

async function main() {
  // Create a memory instance
  const memory = new Memory();

  // Create an agent with memory
  const agent = new Agent({
    name: "ConversationAssistant",
    instructions: "You are a helpful, friendly assistant.",
    model: openai("gpt-4o"),
    memory: memory,
  });

  // Create IDs for the conversation
  const resourceId = "example_user";
  const threadId = "example_conversation";

  // First message - introduce the user
  console.log("\n--- First Turn ---");
  console.log("User: My name is Taylor and I'm a software developer working on a new project.");
  
  const response1 = await agent.stream(
    "My name is Taylor and I'm a software developer working on a new project.",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of response1.textStream) {
    process.stdout.write(chunk);
  }

  // Second message - ask a question that requires previous context
  console.log("\n\n--- Second Turn ---");
  console.log("User: What's my name and what do I do for work?");
  
  const response2 = await agent.stream(
    "What's my name and what do I do for work?",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of response2.textStream) {
    process.stdout.write(chunk);
  }

  // Third message - introduce a new topic
  console.log("\n\n--- Third Turn ---");
  console.log("User: I'm thinking about using TypeScript for my project. What do you think?");
  
  const response3 = await agent.stream(
    "I'm thinking about using TypeScript for my project. What do you think?",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of response3.textStream) {
    process.stdout.write(chunk);
  }

  // Fourth message - reference both earlier topics
  console.log("\n\n--- Fourth Turn ---");
  console.log("User: Given my role as a developer, would you recommend any TypeScript resources?");
  
  const response4 = await agent.stream(
    "Given my role as a developer, would you recommend any TypeScript resources?",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of response4.textStream) {
    process.stdout.write(chunk);
  }

  // Optional: Retrieve messages to see what was stored
  console.log("\n\n--- Memory Content ---");
  const { messages } = await memory.query({
    threadId,
    selectBy: { all: true },
  });

  console.log(`Thread contains ${messages.length} messages.`);
  
  // Write messages to file for inspection
  fs.writeFileSync(
    "conversation-memory.json",
    JSON.stringify(messages, null, 2)
  );
  console.log("Messages written to conversation-memory.json");
}

main().catch(console.error);
```

## Expected Output

```
--- First Turn ---
User: My name is Taylor and I'm a software developer working on a new project.
Assistant: Hi Taylor! It's great to meet you. Being a software developer working on a new project sounds exciting. What kind of project are you developing? I'd be happy to help with any questions or challenges you might have along the way.

--- Second Turn ---
User: What's my name and what do I do for work?
Assistant: Your name is Taylor and you work as a software developer. You mentioned you're currently working on a new project.

--- Third Turn ---
User: I'm thinking about using TypeScript for my project. What do you think?
Assistant: Using TypeScript for your project is an excellent choice, Taylor! As a software developer, you'll benefit from TypeScript in several ways:

1. Static typing helps catch errors during development rather than at runtime
2. Enhanced IDE support with better autocomplete and refactoring tools
3. Improved code documentation through type definitions
4. Better scalability for larger projects
5. Easier maintenance, especially when working in teams

TypeScript is particularly valuable for new projects because you can set up the type system from the beginning, rather than adding it to an existing JavaScript codebase. It's widely adopted in the industry with great community support and extensive libraries with type definitions.

What kind of project are you building? Depending on the specifics, I might be able to offer more tailored advice about TypeScript implementation.

--- Fourth Turn ---
User: Given my role as a developer, would you recommend any TypeScript resources?
Assistant: Absolutely, Taylor! Here are some TypeScript resources that would be valuable for you as a developer:

1. **Documentation and Learning**:
   - [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - The official documentation is comprehensive and well-structured
   - [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - A free online book with advanced concepts

2. **Courses**:
   - Matt Pocock's ["Total TypeScript"](https://www.totaltypescript.com/) - Highly regarded for practical TypeScript skills
   - Maximilian Schwarzmüller's courses on Udemy

3. **Tools**:
   - TSConfig Reference: https://www.typescriptlang.org/tsconfig
   - TypeScript Playground: https://www.typescriptlang.org/play

4. **For Project Setup**:
   - ts-node for running TypeScript directly
   - ts-jest for testing
   - ESLint with TypeScript plugins for linting

5. **Type Definition Resources**:
   - DefinitelyTyped (for third-party libraries without built-in types)
   - Type challenges: https://github.com/type-challenges/type-challenges

6. **Community**:
   - TypeScript Discord server
   - TypeScript GitHub discussions

Given your role as a software developer starting a new project, I'd especially recommend looking at project templates or starter kits for your specific use case (web app, API, etc.) to get the TypeScript configuration set up correctly from the beginning.

Is there a specific aspect of TypeScript you'd like to dive deeper into?

--- Memory Content ---
Thread contains 8 messages.
Messages written to conversation-memory.json
```

## How It Works

1. **Memory Setup**: We create a Memory instance and attach it to the agent.
2. **Conversation Flow**: Each interaction uses the same `resourceId` and `threadId` to maintain context.
3. **Automatic Memory**: Messages are automatically saved and retrieved without any explicit code.
4. **Context Recall**: The agent remembers previous information (name, profession) across turns.
5. **Memory Inspection**: We can retrieve all stored messages to see what's in memory.

## Key Points

- Memory is handled automatically when you provide `resourceId` and `threadId`
- No need to manually manage conversation history
- The agent can reference information from earlier messages
- Thread and resource identifiers create a stable context

## Variations

### Custom Memory Options

To customize memory retrieval:

```typescript
// Customize memory options for specific requests
const response = await agent.stream("Your message", {
  resourceId,
  threadId,
  memoryOptions: {
    lastMessages: 10,  // Only retrieve 10 most recent messages
    semanticRecall: {
      topK: 5,         // Find 5 most relevant past messages
      messageRange: 2, // Include 2 messages before and after each match
    },
  },
});
```

### Using with AI SDK

For web applications using AI SDK:

```typescript
// Server-side handler
export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1];
  
  // Use your own logic to determine resourceId and threadId
  // (typically from authentication and session/URL params)
  const resourceId = "user_123";
  const threadId = "conversation_456";
  
  const stream = await agent.stream(latestMessage.content, {
    resourceId,
    threadId,
  });
  
  return stream.toDataStreamResponse();
}
```

### Working with Node.js Readline

For interactive CLI applications:

```typescript
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function chat() {
  const resourceId = "cli_user";
  const threadId = "cli_session";
  
  console.log("Chat with the agent (type 'exit' to quit)");
  
  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      
      process.stdout.write('Agent: ');
      const response = await agent.stream(input, {
        resourceId,
        threadId,
      });
      
      for await (const chunk of response.textStream) {
        process.stdout.write(chunk);
      }
      console.log('\n');
      
      askQuestion();
    });
  };
  
  askQuestion();
}

chat();
```

## Related Examples

- [Semantic Recall Example](./semantic-recall.md): Advanced memory retrieval with semantic search
- [Working Memory Example](./working-memory.md): Maintaining persistent user information 