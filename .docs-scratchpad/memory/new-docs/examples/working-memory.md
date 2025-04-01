# Working Memory Example

This example demonstrates how to use Mastra's working memory feature to persistently store and recall user information, preferences, and other contextual details across interactions.

## Implementation

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { maskStreamTags } from "@mastra/core/utils";
import fs from "fs";

async function main() {
  // Create memory with working memory enabled
  const memory = new Memory({
    options: {
      workingMemory: {
        enabled: true,
        // Optional custom template - we'll use a simplified one for this example
        template: `<user>
  <name></name>
  <preferences>
    <theme></theme>
    <language></language>
  </preferences>
  <tasks>
    <pending></pending>
    <completed></completed>
  </tasks>
</user>`,
      },
      // Using minimal message history to demonstrate working memory's value
      lastMessages: 3,
    },
  });

  // Create an agent with working memory
  const agent = new Agent({
    name: "PersonalAssistant",
    instructions: "You are a helpful personal assistant that remembers user details and preferences.",
    model: openai("gpt-4o"),
    memory: memory,
  });

  // Set up conversation identifiers
  const resourceId = "example_user";
  const threadId = "personal_assistant";

  // First conversation turn - introduce user
  console.log("\n=== Turn 1: Introduction ===");
  console.log("User: Hello, I'm Alex. I prefer dark mode UIs and I like to code in Python.");
  
  const response1 = await agent.stream(
    "Hello, I'm Alex. I prefer dark mode UIs and I like to code in Python.",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  // Mask working_memory tags to keep them invisible to the user
  for await (const chunk of maskStreamTags(response1.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Check what's stored in working memory after first turn
  const workingMemoryState1 = await memory.getWorkingMemory({ resourceId });
  console.log("Working Memory After Turn 1:");
  console.log(workingMemoryState1.memory);
  console.log();

  // Second conversation turn - add a task
  console.log("\n=== Turn 2: Adding Task ===");
  console.log("User: I need to finish my data analysis project by Friday.");
  
  const response2 = await agent.stream(
    "I need to finish my data analysis project by Friday.",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of maskStreamTags(response2.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Check working memory after second turn
  const workingMemoryState2 = await memory.getWorkingMemory({ resourceId });
  console.log("Working Memory After Turn 2:");
  console.log(workingMemoryState2.memory);
  console.log();

  // Third turn - completely unrelated topic
  console.log("\n=== Turn 3: Unrelated Topic ===");
  console.log("User: What's the capital of France?");
  
  const response3 = await agent.stream(
    "What's the capital of France?",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of maskStreamTags(response3.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Fourth turn - test if agent remembers user details despite minimal message history
  console.log("\n=== Turn 4: Memory Test ===");
  console.log("User: Can you remind me of my UI preference and what task I need to complete?");
  
  const response4 = await agent.stream(
    "Can you remind me of my UI preference and what task I need to complete?",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of maskStreamTags(response4.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Check message history to confirm minimal context
  const { messages } = await memory.query({
    threadId,
    selectBy: { last: 4 }, // Getting the last 4 messages to see what context the agent had
  });

  console.log(`\nMessage history for Turn 4 (${messages.length} messages):`);
  messages.forEach((msg, i) => {
    console.log(`[Message ${i + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
  });

  // Mark task as complete
  console.log("\n=== Turn 5: Completing Task ===");
  console.log("User: I've finished my data analysis project.");
  
  const response5 = await agent.stream(
    "I've finished my data analysis project.",
    {
      resourceId,
      threadId,
    }
  );

  console.log("Assistant: ");
  for await (const chunk of maskStreamTags(response5.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // Final working memory state
  const workingMemoryFinal = await memory.getWorkingMemory({ resourceId });
  console.log("Final Working Memory State:");
  console.log(workingMemoryFinal.memory);
  
  // Save working memory for inspection
  fs.writeFileSync(
    "working-memory-example.xml",
    workingMemoryFinal.memory
  );
  console.log("Working memory saved to working-memory-example.xml");
}

// Run the example
main().catch(console.error);
```

## Expected Output

```
=== Turn 1: Introduction ===
User: Hello, I'm Alex. I prefer dark mode UIs and I like to code in Python.
Assistant: Hi Alex! It's nice to meet you. I'll remember that you prefer dark mode UIs and enjoy coding in Python. Is there anything specific I can help you with today?

Working Memory After Turn 1:
<user>
  <name>Alex</name>
  <preferences>
    <theme>dark mode</theme>
    <language>Python</language>
  </preferences>
  <tasks>
    <pending></pending>
    <completed></completed>
  </tasks>
</user>

=== Turn 2: Adding Task ===
User: I need to finish my data analysis project by Friday.
Assistant: I've noted that you need to finish your data analysis project by Friday, Alex. That's good to know. Would you like me to help you set reminders or would you like any assistance with your Python-based data analysis?

Working Memory After Turn 2:
<user>
  <name>Alex</name>
  <preferences>
    <theme>dark mode</theme>
    <language>Python</language>
  </preferences>
  <tasks>
    <pending>Finish data analysis project by Friday</pending>
    <completed></completed>
  </tasks>
</user>

=== Turn 3: Unrelated Topic ===
User: What's the capital of France?
Assistant: The capital of France is Paris.

=== Turn 4: Memory Test ===
User: Can you remind me of my UI preference and what task I need to complete?
Assistant: You prefer dark mode UIs, and you need to finish your data analysis project by Friday.

Message history for Turn 4 (4 messages):
[Message 1] user: What's the capital of France?...
[Message 2] assistant: The capital of France is Paris....
[Message 3] user: Can you remind me of my UI preference and what...
[Message 4] assistant: <working_memory><user><name>Alex</name><pre...

=== Turn 5: Completing Task ===
User: I've finished my data analysis project.
Assistant: That's great news, Alex! I've updated your task as completed. Is there a new project you're planning to work on next? Since you enjoy Python, I'm here if you need any assistance with future coding projects.

Final Working Memory State:
<user>
  <name>Alex</name>
  <preferences>
    <theme>dark mode</theme>
    <language>Python</language>
  </preferences>
  <tasks>
    <pending></pending>
    <completed>Data analysis project</completed>
  </tasks>
</user>

Working memory saved to working-memory-example.xml
```

## How It Works

1. **Memory Configuration**: We create a memory instance with working memory enabled and a custom template.
2. **Working Memory Template**: We define an XML structure with fields for user name, preferences, and tasks.
3. **Limited Message History**: We set `lastMessages: 3` to demonstrate that working memory persists even with minimal context.
4. **Tag Masking**: We use `maskStreamTags` to prevent working memory tags from being visible to the user.
5. **Automatic Updates**: The agent automatically updates working memory based on conversation.
6. **Persistence**: Working memory persists across turns, allowing the agent to recall information even with limited message history.
7. **Memory Inspection**: We retrieve working memory state at different points to observe how it evolves.

## Key Points

- Working memory provides persistent storage for user details and context
- It operates independently of message history (works even with minimal message context)
- The agent automatically updates working memory as new information emerges
- The XML structure makes it easy to store structured information
- Working memory tags are masked in the output to remain invisible to users

## Variations

### Custom Working Memory Modes

You can configure working memory to use tool calls instead of text stream tags:

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      use: 'tool-call', // Alternative to the default 'text-stream'
    },
  },
});
```

### Working Memory in Production Applications

In production environments, you might hook into memory updates:

```typescript
// Streaming with lifecycle hooks for memory updates
async function streamWithMemoryHooks(agent, message, resourceId, threadId) {
  const response = await agent.stream(message, {
    resourceId,
    threadId,
  });
  
  const maskedStream = maskStreamTags(response.textStream, "working_memory", {
    onStart: () => console.log("Beginning memory update..."),
    onMask: (chunk) => console.log(`Memory update: ${chunk}`),
    onEnd: () => console.log("Memory update complete"),
  });
  
  for await (const chunk of maskedStream) {
    // Send to client
    process.stdout.write(chunk);
  }
}
```

### Complex Working Memory Templates

For more sophisticated applications, you can create detailed templates:

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `<user>
  <personal>
    <name></name>
    <location></location>
    <timezone></timezone>
    <profession></profession>
  </personal>
  <preferences>
    <theme></theme>
    <language></language>
    <communication_style></communication_style>
    <interests></interests>
  </preferences>
  <account>
    <subscription_tier></subscription_tier>
    <features_enabled></features_enabled>
    <usage_history></usage_history>
  </account>
  <context>
    <current_project></current_project>
    <goals></goals>
    <blockers></blockers>
  </context>
</user>`,
    },
  },
});
```

### Retrieving Working Memory Directly

For diagnostic or UI purposes, you can retrieve working memory directly:

```typescript
// Get working memory for a user
const { memory: workingMemory } = await memory.getWorkingMemory({ 
  resourceId: "user_123" 
});

// Use the working memory XML in your application
console.log(workingMemory);

// You could parse this XML for UI purposes
const parsedMemory = parseXML(workingMemory);
console.log(`User name: ${parsedMemory.user.name}`);
console.log(`Theme preference: ${parsedMemory.user.preferences.theme}`);
```

## Related Examples

- [Basic Conversation Example](./conversation.md): Simple conversation with message history
- [Semantic Recall Example](./semantic-recall.md): Finding and utilizing relevant past information 