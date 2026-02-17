# Common Errors and Troubleshooting

Comprehensive guide to common Mastra errors and their solutions.

## Build and configuration errors

### "Cannot find module" or import errors

**Symptoms**:

```bash
Error: Cannot find module '@mastra/core'
SyntaxError: Cannot use import statement outside a module
```

**Causes**:

- CommonJS configuration in `tsconfig.json`
- Missing `"type": "module"` in `package.json`
- Incorrect module resolution

**Solutions**:

1. Update `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ES2022",
       "moduleResolution": "bundler"
     }
   }
   ```

2. Add to `package.json`:

   ```json
   {
     "type": "module"
   }
   ```

3. Ensure imports use `.js` extensions for local files (if needed by your bundler)

### "Property X does not exist on type Y"

**Symptoms**:

```bash
Property 'tools' does not exist on type 'Agent'
Property 'memory' does not exist on type 'AgentConfig'
```

**Causes**:

- Outdated API usage (Mastra is actively developed)
- Incorrect import or type
- Version mismatch between docs and installed package

**Solutions**:

1. Check embedded docs (see `embedded-docs.md`) to check current API
2. Check `node_modules/@mastra/core/dist/docs/SOURCE_MAP.json` for current exports
3. Verify package versions: `npm list @mastra/core`
4. Update dependencies: `npm update @mastra/core`

## Agent errors

### Agent not using assigned tools

**Symptoms**:

- Agent responds "I don't have access to that tool"
- Tools never get called despite being relevant

**Causes**:

- Tools not registered in Mastra instance
- Tools not passed to Agent constructor
- Tool IDs don't match

**Solutions**:

**Correct pattern**:

```typescript
// 1. Create tool
const weatherTool = createTool({
  id: "get-weather",
  // ... tool config
});

// 2. Register in Mastra instance
const mastra = new Mastra({
  tools: {
    weatherTool, // or 'weatherTool': weatherTool
  },
});

// 3. Assign to agent
const agent = new Agent({
  id: "weather-agent",
  tools: { weatherTool }, // Reference the tool
  // ... other config
});
```

**Alternative pattern (direct assignment)**:

```typescript
const agent = new Agent({
  id: "weather-agent",
  tools: {
    weatherTool: createTool({ id: "get-weather" /* ... */ }),
  },
});
```

### Agent memory not persisting

**Symptoms**:

- Agent doesn't remember previous messages
- Conversation history is lost between calls

**Causes**:

- No storage backend configured
- Missing or inconsistent `threadId`
- Memory not assigned to agent

**Solutions**:

```typescript
// 1. Configure storage
const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL,
});

// 2. Create memory with storage
const memory = new Memory({
  id: "chat-memory",
  storage,
  options: {
    lastMessages: 10, // How many messages to retrieve
  },
});

// 3. Assign memory to agent
const agent = new Agent({
  id: "chat-agent",
  memory,
});

// 4. Use consistent threadId
await agent.generate("Hello", {
  threadId: "user-123-conversation", // Same threadId for entire conversation
  resourceId: "user-123",
});
```

## Workflow errors

### "Cannot read property 'then' of undefined"

**Symptoms**:

```bash
TypeError: Cannot read property 'then' of undefined
Workflow execution fails immediately
```

**Causes**:

- Forgot to call `.commit()` on workflow
- Step returns undefined

**Solutions**:

**Correct pattern**:

```typescript
const workflow = createWorkflow({
  id: "my-workflow",
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit(); // REQUIRED!

// Then execute
const run = await workflow.createRun();
const result = await run.start({ inputData: { data: "test" } });
```

### Workflow state not updating

**Symptoms**:

- State changes don't persist across steps
- `getStepResult()` returns undefined

**Causes**:

- Not using `setState` to update state
- Accessing state before step completes

**Solutions**:

```typescript
const step1 = createStep({
  id: "step1",
  execute: async ({ state, setState }) => {
    // Update state
    await setState({ ...state, counter: (state.counter || 0) + 1 });
    return { result: "done" };
  },
});

// Access state in subsequent steps
const step2 = createStep({
  id: "step2",
  execute: async ({ state }) => {
    console.log(state.counter); // Access updated state
    return { result: "complete" };
  },
});
```

## Memory errors

### "Storage is required for Memory"

**Symptoms**:

```bash
Error: Storage is required for Memory
Memory instantiation fails
```

**Causes**:

- Memory created without storage backend

**Solutions**:

```typescript
// Always provide storage when creating Memory
const memory = new Memory({
  id: "my-memory",
  storage: postgresStore, // REQUIRED
  options: {
    lastMessages: 10,
  },
});
```

### Semantic recall not working

**Symptoms**:

- Memory doesn't retrieve semantically similar messages
- Only recent messages are returned

**Causes**:

- No vector store configured
- No embedder configured
- `semanticRecall` not enabled

**Solutions**:

```typescript
const memory = new Memory({
  id: "semantic-memory",
  storage: postgresStore,
  vector: chromaVectorStore, // REQUIRED for semantic recall
  embedder: openaiEmbedder, // REQUIRED for semantic recall
  options: {
    lastMessages: 10,
    semanticRecall: true, // REQUIRED
  },
});
```

## Tool errors

### "Tool validation failed"

**Symptoms**:

```bash
Error: Input validation failed for tool 'my-tool'
ZodError: Expected string, received number
```

**Causes**:

- Input doesn't match inputSchema
- Missing required fields
- Type mismatch

**Solutions**:

```typescript
const tool = createTool({
  id: "my-tool",
  inputSchema: z.object({
    name: z.string(),
    age: z.number().optional(), // Make optional fields explicit
  }),
  execute: async (input) => {
    // input is validated and typed
    return { result: `Hello ${input.name}` };
  },
});

// Correct usage
await tool.execute({ name: "Alice" }); // Works
await tool.execute({ name: "Bob", age: 30 }); // Works
await tool.execute({ age: 30 }); // ERROR: name is required
```

### Tool suspension not resuming

**Symptoms**:

- Tool suspends but never resumes
- resumeData is undefined

**Causes**:

- Not calling workflow.resume() or agent.generate() with resumeData
- Incorrect resumeSchema

**Solutions**:

```typescript
const approvalTool = createTool({
  id: "approval",
  inputSchema: z.object({ request: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ requestId: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async (input, context) => {
    if (!context.resumeData) {
      // First call - suspend
      const requestId = generateId();
      context.suspend({ requestId });
      return; // Execution pauses here
    }

    // Resumed - use resumeData
    return { approved: context.resumeData.approved };
  },
});

// Resume the workflow/agent
await run.resume({
  resumeData: { approved: true },
});
```

## Storage errors

### "Connection refused" or "Database does not exist"

**Symptoms**:

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: database "mastra" does not exist
```

**Causes**:

- Database not running
- Incorrect connection string
- Database not created

**Solutions**:

1. Start database (Postgres example):

```bash
docker run -d \
  --name mastra-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=mastra \
  -p 5432:5432 \
  postgres:16
```

2. Verify connection string:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mastra
```

3. Initialize storage:

```typescript
const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL,
});
await storage.init(); // Creates tables if needed
```

## Environment variable errors

### "API key not found"

**Symptoms**:

```bash
Error: OPENAI_API_KEY environment variable is not set
401 Unauthorized
```

**Causes**:

- Missing .env file
- Environment variables not loaded
- Incorrect variable name

**Solutions**:

1. Create .env file:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

2. Load environment variables (for Node.js):

```typescript
import "dotenv/config"; // At top of entry file
```

3. Verify variable is loaded:

```typescript
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required");
}
```

## Model errors

### "Model not found" or "Invalid model"

**Symptoms**:

```bash
Error: Model 'gpt-4' not found
Error: Invalid model format
```

**Causes**:

- Incorrect model format (should be `provider/model`)
- Unsupported model
- Missing provider API key

**Solutions**:

**Correct model format**:

```typescript
const agent = new Agent({
  model: "openai/gpt-4o", // ✅ Correct
  // NOT: model: 'gpt-4o'       // ❌ Missing provider
});
```

**Common models**:

- OpenAI: `openai/gpt-4o`, `openai/gpt-4o-mini`, `openai/gpt-4-turbo`
- Anthropic: `anthropic/claude-sonnet-4-5-20250929`, `anthropic/claude-opus-4-5`
- Google: `google/gemini-2.0-pro`, `google/gemini-2.0-flash`

**Use embedded docs to verify**:

```bash
# Check supported models
ls node_modules/@mastra/core/dist/docs/
# See embedded-docs.md for lookup instructions
```

## Debugging tips

### Enable verbose logging

```typescript
const mastra = new Mastra({
  logger: new PinoLogger({
    name: "mastra",
    level: "debug", // or 'trace' for even more detail
  }),
});
```

### Test in Studio

```bash
npm run dev
# Open http://localhost:4111
# Test agents and workflows interactively
```

### Check package versions

```bash
npm list @mastra/core
npm list @mastra/memory
npm list @mastra/rag
```

### Validate TypeScript config

```bash
npx tsc --showConfig
# Verify target: ES2022, module: ES2022
```

## Getting help

1. **Check embedded docs**: Check embedded docs (see `embedded-docs.md`)
2. **Search documentation**: [mastra.ai/docs](https://mastra.ai/docs)
3. **Check version compatibility**: Ensure all @mastra packages are same version
4. **File an issue**: [github.com/mastra-ai/mastra](https://github.com/mastra-ai/mastra)
