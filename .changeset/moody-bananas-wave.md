---
'@mastra/evals': minor
---

Added an `includeConversationHistory` option to the Prompt Alignment scorer so multi-turn agent runs are scored in context.

Previously the scorer only saw the current turn. In a conversation a short reply like `"A"` has no meaning on its own, so the judge could not tell what the user asked for and scored a perfectly good response as misaligned. The scorer now optionally includes the prior turns from the agent's memory, uses them to interpret the current prompt, and still scores only the current response.

**Before**

```typescript
const scorer = createPromptAlignmentScorerLLM({
  model: 'openai/gpt-5-mini',
  options: { evaluationMode: 'user' },
});
```

**After**

```typescript
const scorer = createPromptAlignmentScorerLLM({
  model: 'openai/gpt-5-mini',
  options: {
    evaluationMode: 'user',
    includeConversationHistory: true, // or { maxMessages: 6 }
  },
});
```

The option is off by default, so existing scores do not change. It only applies to agent runs, which are the runs that carry remembered messages. Fixes https://github.com/mastra-ai/mastra/issues/21638
