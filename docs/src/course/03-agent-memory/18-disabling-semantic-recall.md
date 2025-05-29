# Disabling Semantic Recall

In some cases, you might want to disable semantic recall, for example, if you're building a simple chatbot that doesn't need to recall older conversations. You can do this by setting `enabled: false`:

```typescript
const memory = new Memory({
  options: {
    semanticRecall: {
      enabled: false, // Disable semantic recall
    },
  },
});
```

Disabling semantic recall can be useful in several scenarios:

1. When building simple chatbots that only need to maintain context within the current conversation
2. When working with sensitive information that shouldn't be retrieved from past conversations
3. When optimizing for performance and reducing the computational overhead of semantic search
4. When testing the behavior of your agent without the influence of semantic recall

Even with semantic recall disabled, your agent will still have access to recent conversation history through the `lastMessages` option, so it can maintain context within the current conversation.

In the next step, we'll explore working memory, which allows your agent to maintain persistent information about users across interactions.
