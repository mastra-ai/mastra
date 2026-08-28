---
'@mastra/editor': patch
---

Fixed Studio instruction edits dropping `providerOptions` from code-defined agents. When code defines instructions as a structured system message — for example with an Anthropic prompt-cache breakpoint — editing and publishing the instructions in Studio replaced them with a plain string, silently removing the provider options. Every request then paid full uncached input cost until the override was removed.

Studio now owns only the wording: the published text is wrapped back in the code-defined message envelope when the override is applied, so provider options survive edits. This applies retroactively — existing published overrides pick up the code envelope on upgrade, with no migration needed.

```ts
const agent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: {
    role: 'system',
    content: 'You are a helpful voice assistant.',
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
  model: 'anthropic/claude-sonnet-4-6',
});

// Before: after publishing an instructions edit in Studio, the agent ran with a
// plain string — the cacheControl breakpoint was gone until the override was deleted.
// After: the edited text is published inside the same system message, and
// providerOptions.anthropic.cacheControl keeps working.
```

Instructions delegated entirely to Studio (`editor: { instructions: true }`) have no code-defined envelope and are unaffected. Fixes https://github.com/mastra-ai/mastra/issues/10980
