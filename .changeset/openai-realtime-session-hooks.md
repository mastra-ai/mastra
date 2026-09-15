---
'@mastra/voice-openai-realtime': minor
---

Added session hooks to `OpenAIRealtimeVoice` for applications that manage parts of the OpenAI Realtime session themselves. Every server event is now re-emitted as `openAIRealtime:<event.type>`, the socket emits `open` and `close`, and `sendEvent()` is public so you can send any client event, such as adding conversation items.

```typescript
voice.on('openAIRealtime:rate_limits.updated', event => console.log(event.rate_limits));
voice.on('close', ({ code, reason }) => console.log('socket closed', code, reason));

voice.sendEvent('conversation.item.create', {
  item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
});
```

Fixed the provider sending an extra `response.create` for function calls whose tools were not registered with `addTools()`. Tools declared directly through `session.update` are now left to the application, so OpenAI no longer rejects the application's own `response.create` with `conversation_already_has_active_response`. Fixes [#20219](https://github.com/mastra-ai/mastra/issues/20219).
