# Working Memory FAQ

This FAQ specifically addresses questions about Mastra's working memory feature, which allows agents to maintain persistent structured information about users and conversations.

## Fundamentals

### What exactly is "working memory" in Mastra?

Working memory is a specialized memory feature that allows agents to:
- Store structured information about users or conversations
- Maintain this information across conversation turns 
- Access it even when previous messages are outside the context window
- Update it over time as new information becomes available

Unlike regular memory (which stores whole messages), working memory is designed for keeping track of key facts, preferences, and stateful information in a structured format.

### How is working memory different from regular conversation memory?

| Regular Memory | Working Memory |
|----------------|----------------|
| Stores complete conversation messages | Stores structured data in XML or via tool calls |
| Limited by context window size | Available regardless of conversation length |
| Primarily chronological | Organized by data structure |
| Contains everything said | Contains only what the agent chooses to remember |
| Automatically captures all messages | Requires agent to actively update |

Working memory complements conversation history by providing persistent, structured storage for important information.

## Configuration and Setup

### How do I enable working memory for my agent?

Enable working memory in your Memory configuration:

```typescript
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";

// Create memory with working memory enabled
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      // Optional: provide a custom template
      template: `<user>
  <name></name>
  <preferences></preferences>
</user>`,
    },
  },
});

const agent = new Agent({
  name: "AssistantAgent",
  instructions: "You are a helpful assistant that remembers user preferences.",
  model: openai("gpt-4o"),
  memory: memory,
});
```

### What are the two modes of working memory and how do they differ?

Working memory has two operating modes:

1. **Text Stream Mode** (default)
   - Agent includes XML tags directly in its response
   - Example: `<working_memory><user><name>John</name></user></working_memory>`
   - Easier to implement
   - Can be more inconsistent with some models
   - Requires masking the XML tags in streaming responses

2. **Tool Call Mode**
   - Agent updates working memory via explicit tool calls
   - More structured approach
   - Better for streaming
   - More consistent with some models
   - Easier to validate

Configure tool call mode:
```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      use: "tool-call", // Set mode to tool-call
    },
  },
});
```

## Usage and Scope

### Is working memory stored per agent, per user, or per conversation?

Working memory is stored per **resource-thread combination**. This means:
- It's tied to a specific user (resourceId) and conversation (threadId)
- Different conversations for the same user have separate working memory
- Different agents accessing the same thread will see the same working memory
- Working memory persists across multiple interactions within the same thread

This scoping allows for personalized, conversation-specific information to be maintained regardless of which agent is handling the interaction.

### How do I get my agent to effectively use working memory?

For best results:

1. **Add explicit instructions** in your agent's system prompt:
   ```typescript
   const agent = new Agent({
     instructions: `You are a helpful assistant that remembers user information.
       
       IMPORTANT: When you learn about the user, update your working memory.
       Store their name, preferences, and any important details.
       Refer to working memory before asking for information you should already know.`,
     // other options
   });
   ```

2. **Provide a clear template** with fields the agent should populate
3. **Use tool-call mode** for more reliable updates
4. **Add validation logic** in your application to verify working memory quality

## Templates and Structure

### How do I design an effective working memory template?

Good templates should be:
1. **Structured**: Use nested XML tags to organize related information
2. **Comprehensive**: Include all fields you expect to need
3. **Clear**: Use descriptive tag names
4. **Flexible**: Allow for storing multiple related items

Example template:
```typescript
template: `<user>
  <personal_info>
    <name></name>
    <location></location>
    <timezone></timezone>
  </personal_info>
  <preferences>
    <theme></theme>
    <communication_style></communication_style>
  </preferences>
  <tasks>
    <!-- Multiple task entries can be added here -->
  </tasks>
</user>`,
```

### Can I strictly enforce my template structure?

Currently, working memory templates are suggestions rather than strict schemas. The LLM can deviate from the template structure.

To improve adherence:
1. Use the `tool-call` mode which tends to produce more consistent updates
2. Add explicit instructions about maintaining the template structure
3. Consider post-processing working memory updates in your application code to enforce structure

In a future release, Mastra plans to support schema validation for working memory, especially with tool-call mode.

## Advanced Usage

### How do I access working memory content in my application code?

You can retrieve working memory content using the memory API:

```typescript
// Get working memory content
const workingMemory = await memory.getWorkingMemory({
  resourceId: "user_123",
  threadId: "conversation_456",
});

// Parse the XML content (example with fast-xml-parser)
import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser();
const parsedMemory = parser.parse(workingMemory);

// Use the data in your application
console.log("User name:", parsedMemory.user.personal_info.name);
```

### Can I manually update working memory from my application code?

Yes, you can programmatically update working memory:

```typescript
// Set working memory content
await memory.setWorkingMemory({
  resourceId: "user_123",
  threadId: "conversation_456",
  content: `<user>
  <personal_info>
    <name>John Doe</name>
    <location>San Francisco</location>
  </personal_info>
  <preferences>
    <theme>dark</theme>
  </preferences>
</user>`,
});
```

This is useful for:
- Initializing working memory with known user data
- Correcting or augmenting agent-maintained data
- Synchronizing working memory with your application's database

### How can I use working memory to implement custom behavior in my application?

Working memory enables powerful customization:

1. **Conditional logic**: Parse working memory to trigger specific application behaviors
   ```typescript
   // Check preferences and customize UI
   if (parsedMemory.user.preferences.theme === "dark") {
     setTheme("dark");
   }
   ```

2. **Dynamic agent instructions**: Modify agent behavior based on working memory
   ```typescript
   // Tailor agent instructions based on preferences
   const communicationStyle = parsedMemory.user.preferences.communication_style;
   const customInstructions = `Communicate in a ${communicationStyle} style.`;
   ```

3. **Multi-agent systems**: Share structured state between agents
   ```typescript
   // Let specialized agents handle different aspects of the same conversation
   // They'll all see the same working memory when using the same resourceId/threadId
   ```

4. **Persistent application state**: Use working memory as a stateful database
   ```typescript
   // Track application state across sessions
   const currentStep = parsedMemory.app_state.wizard_progress;
   ```

## Troubleshooting

### Why is my agent not updating working memory consistently or correctly?

Common issues and solutions:

1. **Model capability**: Larger, more capable models (like GPT-4) handle working memory better than smaller models
2. **Unclear instructions**: Add explicit directions about updating working memory
3. **Complex template**: Simplify your template if the agent struggles with it
4. **Mode issues**: Try switching between text-stream and tool-call modes
5. **Template mismatch**: Ensure your template matches what you explain in instructions

A good debugging approach:
```typescript
// Log working memory updates for debugging
const stream = await agent.stream("...", { resourceId, threadId });
const maskedStream = maskStreamTags(stream.textStream, "working_memory", {
  onMask: (chunk) => console.log("Working memory update:", chunk),
});
``` 