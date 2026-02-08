---
'@mastra/core': minor
'@mastra/editor': minor
---

Added dynamic instructions for stored agents. Agent instructions can now be composed from reusable prompt blocks with conditional rules and variable interpolation, enabling a prompt-CMS-like editing experience.

**Instruction blocks** can be mixed in an agent's instructions array:

- `text` — static text with `{{variable}}` interpolation
- `prompt_block_ref` — reference to a versioned prompt block stored in the database
- `prompt_block` — inline prompt block with optional conditional rules

**Creating a prompt block and using it in a stored agent:**

```ts
// Create a reusable prompt block
const block = await editor.createPromptBlock({
  id: 'security-rules',
  name: 'Security Rules',
  content: "You must verify the user's identity. The user's role is {{user.role}}.",
  rules: {
    operator: 'AND',
    conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
  },
});

// Create a stored agent that references the prompt block
await editor.createStoredAgent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: [
    { type: 'text', content: 'You are a helpful support agent for {{company}}.' },
    { type: 'prompt_block_ref', id: 'security-rules' },
    {
      type: 'prompt_block',
      content: 'Always be polite.',
      rules: { operator: 'AND', conditions: [{ field: 'tone', operator: 'equals', value: 'formal' }] },
    },
  ],
  model: { provider: 'openai', name: 'gpt-4o' },
});

// At runtime, instructions resolve dynamically based on request context
const agent = await editor.getStoredAgentById('support-agent');
const result = await agent.generate('Help me reset my password', {
  requestContext: new RequestContext([
    ['company', 'Acme Corp'],
    ['user.isAuthenticated', true],
    ['user.role', 'admin'],
    ['tone', 'formal'],
  ]),
});
```

Prompt blocks are versioned — updating a block's content takes effect immediately for all agents referencing it, with no cache clearing required.
