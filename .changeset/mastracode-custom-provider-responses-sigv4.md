---
'@mastra/code-sdk': patch
---

Custom OpenAI-compatible providers can now target AWS SigV4-signed endpoints and the OpenAI `/responses` API.

`customProviders` entries gain three optional fields:

- `auth: 'aws-sigv4'` — sign each request with the AWS credential chain instead of a bearer key (for AWS-hosted OpenAI-compatible endpoints such as Bedrock's, which use SigV4).
- `api: 'responses'` — use the `/v1/responses` API instead of `/v1/chat/completions` (required by models like Bedrock's `openai.gpt-5.x`).
- `store` — for `api: 'responses'`, control server-side state. Defaults to `false` for SigV4 endpoints so replayed history is sent self-contained rather than via `item_reference` items that can expire (which otherwise fail with `Invalid 'input': value did not match any expected variant` on resumed tool sessions).

Defaults preserve prior behavior: an existing custom provider with none of these fields still resolves as a bearer-key `/chat/completions` provider.

Also fixes a resolver bug where model ids cataloged as `mastracode/<custom-provider>/<model>` failed with "Could not find config for provider mastracode" — the `mastracode/` gateway prefix is now stripped for all providers, not just the legacy `amazon-bedrock` case.
