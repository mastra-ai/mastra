---
'mastracode': minor
---

Added Amazon Bedrock as a model provider in Mastra Code. Bedrock models surfaced by models.dev are now selectable via `/models` and usable as build/plan/fast or subagent models with the `amazon-bedrock/<modelId>` form. Models are only offered when AWS credentials are detected.

Bedrock authenticates with AWS SigV4 through the standard AWS credential chain (`fromNodeProviderChain`), so environment variables, shared `~/.aws` profiles, SSO, and container/instance roles all work without extra configuration. Set `AWS_REGION` (defaults to `us-east-1`) to target a region, or `AWS_BEARER_TOKEN_BEDROCK` to use Bedrock API-key auth instead.

```sh
# Pick a Bedrock model from the picker
/models

# Or set it directly via the build/plan/fast slots
/build amazon-bedrock/<modelId>
```
