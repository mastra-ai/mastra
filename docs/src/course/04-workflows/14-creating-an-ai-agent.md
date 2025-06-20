# Creating an AI Agent

Learn how to create an AI agent that can be used within your workflows for more intelligent content processing.

## Creating a Content Analysis Agent

Create a new file for your agent:

```typescript
// src/mastra/agents/content-agent.ts
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const contentAgent = new Agent({
  name: "content-agent",
  description: "AI agent for analyzing and improving content",
  instructions: `
    You are a professional content analyst. Your role is to:
    1. Analyze content for clarity and engagement
    2. Identify the main themes and topics
    3. Provide a quality score from 1-10
    4. Suggest specific improvements
    
    Always provide constructive, actionable feedback.
  `,
  model: openai("gpt-4o-mini")
});
```

## Understanding the Agent

- **Name**: Unique identifier for the agent
- **Description**: What the agent does
- **Instructions**: Detailed prompts that guide the AI's behavior
- **Model**: Which AI model to use (GPT-4o-mini is fast and cost-effective)

## Testing Your Agent

Create a test file to verify your agent works:

```typescript
// src/test-agent.ts
import { contentAgent } from "./mastra/agents/content-agent";

async function testAgent() {
  console.log("🤖 Testing content agent...");
  
  const { text } = await contentAgent.generate([
    {
      role: "user",
      content: "Please analyze this content: 'AI is changing the world rapidly.'"
    }
  ]);
  
  console.log("🎯 Agent response:", text);
}

testAgent();
```

## Running the Agent Test

```bash
npx tsx src/test-agent.ts
```

The agent should provide analysis of the content, including themes, quality assessment, and improvement suggestions.

## Why Use Agents in Workflows?

Agents add intelligence to workflows by:
- **Understanding context**: AI can interpret meaning, not just process data
- **Generating insights**: Provide analysis that simple logic cannot
- **Adapting responses**: Give different feedback based on content type
- **Natural language output**: Communicate results in human-readable form

Your AI agent is ready! Next, you'll learn how to integrate it into a workflow step.