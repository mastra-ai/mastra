---
'mastracode': minor
---

Add Amazon Bedrock as a model provider in Mastra Code.

Bedrock models surfaced by models.dev (Anthropic, Llama, Mistral, Titan, and more) are now selectable via `/models` and usable as build/plan/fast or subagent models using the `amazon-bedrock/<modelId>` form, for example `amazon-bedrock/us.anthropic.claude-opus-4-6-v1`. The model list is fetched from the public models.dev catalog and only offered when AWS credentials are detected.

Bedrock authenticates with AWS SigV4 through the standard AWS credential chain (`fromNodeProviderChain`), so environment variables, shared `~/.aws` profiles, SSO, and container/instance roles all work without extra configuration — the same resolution order as the AWS CLI. Set `AWS_REGION` (defaults to `us-east-1`) to target a region, or `AWS_BEARER_TOKEN_BEDROCK` to use Bedrock API-key auth instead.
