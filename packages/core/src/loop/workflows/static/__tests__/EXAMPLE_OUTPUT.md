# Example Test Output

This shows what you'll see when running the OpenAI integration test with logs enabled.

## Sample Output

```
🚀 Starting OpenAI Integration Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Workflow created
   ID: execution-workflow
   Steps: prepare-tools-step, prepare-memory-step, stream-text-step, map-results-step
   Workflow instance: Workflow

🤖 Model configured: gpt-4o-mini

📤 First Execution
   Run ID: 550e8400-e29b-41d4-a716-446655440000
   Message: "Say "Hello from static workflow!" and nothing else."
   Status: success
   Response: Hello from static workflow!
   Tokens: {"promptTokens":25,"completionTokens":6,"totalTokens":31}
   ✅ First execution complete

📤 Second Execution (reusing same workflow instance)
   Run ID: 661f9511-f3ac-52e5-b827-557766551111
   Message: "Say "Second execution!" and nothing else."
   Status: success
   Response: Second execution!
   Tokens: {"promptTokens":22,"completionTokens":3,"totalTokens":25}
   ✅ Second execution complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TEST PASSED: Same workflow reused - NO MEMORY LEAK!
   - Workflow created once
   - Two executions with different states
   - No workflow recreation overhead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What This Shows

### Workflow Creation (Once)

- **ID**: `execution-workflow`
- **Steps**: All 4 steps are listed
- **Class**: Shows it's a Workflow instance

### Model Configuration

- Using `gpt-4o-mini` for testing
- Real OpenAI API calls

### First Execution

- **Unique Run ID**: Each execution gets its own ID
- **Request**: Shows the message being sent
- **Status**: Workflow completes successfully
- **Response**: Actual response from OpenAI
- **Tokens**: Shows token usage for cost tracking

### Second Execution

- **Different Run ID**: New execution
- **Same Workflow Instance**: No recreation!
- **Different Message**: Different request
- **Independent Response**: Second OpenAI call

### Key Proof Points

✅ Workflow created **once** at the top  
✅ Two separate executions with **different states**  
✅ **No workflow recreation** between calls  
✅ Each execution is **independent** (different runIds, messages, responses)

## Without API Key

If `OPENAI_API_KEY` is not set, the test will be skipped:

```
✓ should create workflow once and run multiple times without memory leaks
✓ should execute workflow with mocked state
✓ should run multiple executions with same workflow instance
✓ should handle tripwire early exit
✓ should not create closures - verify memory safety
↓ should work with real OpenAI model [skipped]
```

## Running the Test

```bash
# With OpenAI API key
OPENAI_API_KEY=sk-... npm test -- static-workflow.test.ts

# Without API key (will skip integration test)
npm test -- static-workflow.test.ts
```
