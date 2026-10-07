---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Factory deployments with sign-in enabled can now use Amazon Bedrock. Set `FACTORY_DEPLOYMENT_MODEL_PROVIDERS=amazon-bedrock` (or `deploymentModelProviders: ['amazon-bedrock']` on `MastraFactory`) along with AWS credentials and `AWS_REGION` on the server. Every signed-in account can then pick Bedrock models. Settings show Bedrock as **From deployment** instead of asking each account for an API key the server never read.

Without the opt-in, Bedrock stays hidden from signed-in accounts and runs fail with a clear `ProviderAuthRequiredError`. Before this change, a run could silently fall back to whatever AWS credentials the server had.
