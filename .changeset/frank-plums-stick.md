---
'@mastra/core': patch
---

Fix ModelRouterLanguageModel to propagate supportedUrls from underlying model providers

Previously, `ModelRouterLanguageModel` (used when specifying models as strings like `"mistral/mistral-large-latest"` or `"openai/gpt-4o"`) had `supportedUrls` hardcoded as an empty object. This caused Mastra to download all file URLs and convert them to bytes/base64, even when the model provider supports URLs natively.

This fix:

- Changes `supportedUrls` to a lazy `PromiseLike` that resolves the underlying model's supported URL patterns
- Updates `llm-execution-step.ts` to properly await `supportedUrls` when preparing messages

**Impact:**

- Mistral: PDF URLs are now passed directly (fixes #12152)
- OpenAI: Image URLs (and PDF URLs in response models) are now passed directly
- Anthropic: Image URLs are now passed directly
- Google: Files from Google endpoints are now passed directly

**Note:** Users who were relying on Mastra to download files from URLs that model providers cannot directly access (internal URLs, auth-protected URLs) may need to adjust their approach by either using base64-encoded content or ensuring URLs are publicly accessible to the model provider.
