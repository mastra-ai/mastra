---
'@mastra/core': patch
'mastracode': patch
---

Amazon Bedrock models now appear under their own `amazon-bedrock/<model>` provider in the model picker instead of the `mastracode/amazon-bedrock/<model>` namespace. Bedrock is resolved through a dedicated Amazon Bedrock gateway that authenticates with the AWS credential chain (SigV4) and surfaces models from the public models.dev catalog. Saved model selections using the previous `mastracode/amazon-bedrock/...` IDs are still resolved at runtime, so existing config keeps working.
