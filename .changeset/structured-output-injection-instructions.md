---
'@mastra/core': minor
---

Added support for caller-supplied `structuredOutput.instructions` with `jsonPromptInjection`. The injected instruction previously always embedded the full JSON schema, which for large schemas adds thousands of tokens to every step; `instructions` was only used by the separate structuring agent. When `jsonPromptInjection` is enabled, `instructions` now replaces the generated "Return your response as JSON matching this schema" text (in the system message or the latest user message, depending on the mode) while the response is still validated against `schema`.

```ts
await agent.generate('Summarize the ticket.', {
  structuredOutput: {
    schema: ticketSchema,
    jsonPromptInjection: 'system',
    instructions: 'Reply with a JSON object: "summary" (one paragraph), "priority" ("low" | "high"), "tags" (up to 5 strings). No markdown.',
  },
});
```
