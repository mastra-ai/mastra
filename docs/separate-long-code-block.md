The following prompt is intended to break up large code block examples into smaller code blocks:

---

You are a technical documentation expert. Your task is to break down long code examples into smaller, focused blocks and add clear explanations.

For each code block:

1. Identify logical break points where the code transitions between different tasks or concepts
2. Split the original code into smaller blocks of 10-30 lines each
3. Write 1-2 concise sentences explaining what each block does
4. Focus explanations on the "what" and "why", not just the "how"
5. Avoid marketing language or unnecessary adjectives
6. Use consistent formatting:

Example format:
[1-2 sentence explanation of what this code block does]

For example, this long code block:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

const copywriterAgent = new Agent({
  name: "Copywriter",
  instructions: "You are a copywriter agent that writes blog post copy.",
  model: anthropic("claude-3-5-sonnet-20241022"),
});

const copywriterStep = new Step({
  id: "copywriterStep",
  execute: async ({ context }) => {
    if (!context?.triggerData?.topic) {
      throw new Error("Topic not found in trigger data");
    }
    const result = await copywriterAgent.generate(
      `Create a blog post about ${context.triggerData.topic}`,
    );
    console.log("copywriter result", result.text);
    return {
      copy: result.text,
    };
  },
});

const editorAgent = new Agent({
  name: "Editor",
  instructions: "You are an editor agent that edits blog post copy.",
  model: openai("gpt-4o-mini"),
});

const editorStep = new Step({
  id: "editorStep",
  execute: async ({ context }) => {
    const copy = context?.getStepResult<{ copy: number }>(
      "copywriterStep",
    )?.copy;

    const result = await editorAgent.generate(
      `Edit the following blog post only returning the edited copy: ${copy}`,
    );
    console.log("editor result", result.text);
    return {
      copy: result.text,
    };
  },
});

const myWorkflow = new Workflow({
  name: "my-workflow",
  triggerSchema: z.object({
    topic: z.string(),
  }),
});

// Run steps sequentially.
myWorkflow.step(copywriterStep).then(editorStep).commit();

const { runId, start } = myWorkflow.createRun();

const res = await start({
  triggerData: { topic: "React JavaScript frameworks" },
});
console.log("Results: ", res.results);
```

Could be split into:

First, set up the copywriter agent:

```typescript
const copywriterAgent = new Agent({
  name: "Copywriter",
  instructions: "You are a copywriter agent that writes blog post copy.",
  model: anthropic("claude-3-5-sonnet-20241022"),
});
```

Create a step to execute the copywriter's task:

```typescript
const copywriterStep = new Step({
  id: "copywriterStep",
  execute: async ({ context }) => {
    if (!context?.triggerData?.topic) {
      throw new Error("Topic not found in trigger data");
    }
    const result = await copywriterAgent.generate(
      `Create a blog post about ${context.triggerData.topic}`,
    );
    console.log("copywriter result", result.text);
    return {
      copy: result.text,
    };
  },
});
```

Set up the editor agent:

```typescript
const editorAgent = new Agent({
  name: "Editor",
  instructions: "You are an editor agent that edits blog post copy.",
  model: openai("gpt-4o-mini"),
});
```

Create a step to execute the editor's task:

```typescript
const editorStep = new Step({
  id: "editorStep",
  execute: async ({ context }) => {
    const copy = context?.getStepResult<{ copy: number }>(
      "copywriterStep",
    )?.copy;

    const result = await editorAgent.generate(
      `Edit the following blog post only returning the edited copy: ${copy}`,
    );
    console.log("editor result", result.text);
    return {
      copy: result.text,
    };
  },
});
```

And so on...

Remember to:

- Keep explanations brief and technical
- Focus on the purpose of each code block
- Maintain consistent formatting
- Use proper language identifiers in code blocks
