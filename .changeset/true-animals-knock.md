---
'@mastra/ai-sdk': patch
---

Fixed `chatRoute` and `handleChatStream` sending server stack traces to chat clients. By default, streamed errors now include only the error name and message, plus a few safe fields (`code`, `id`, `domain`, `category`, `statusCode`, `isRetryable`, and a redacted `cause`). Stack traces, file paths, URLs, and provider request/response payloads are no longer sent. This also applies to tool errors from durable agents. A custom `onError` still receives the full error, and server-side logging is unchanged.
