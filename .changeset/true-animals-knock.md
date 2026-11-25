---
'@mastra/ai-sdk': patch
---

Fixed `chatRoute` and `handleChatStream` sending server stack traces to chat clients. By default, streamed errors now include only the error name and message, plus a few safe fields (`code`, `id`, `domain`, `category`, `statusCode`, `isRetryable`, the provider error `type`, `status` and `param`, and a redacted `cause` or nested `error`). Other properties, such as `stack`, `url`, and provider request/response payloads, are no longer sent. Kept values are passed through unchanged, so an error message that includes a path or URL still reaches the client. This also applies to tool errors from durable agents. A custom `onError` still receives the full error, and server-side logging is unchanged.
