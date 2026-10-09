---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Factory deployments with sign-in enabled can now use Amazon Bedrock. Opt in on the server, then provide AWS credentials and `AWS_REGION` there. Every signed-in account can then pick Bedrock models without saving a per-account API key.

```ts
new MastraFactory({
  // ...
  deploymentModelProviders: ['amazon-bedrock'],
});
```

The web deployment reads the same list from `FACTORY_DEPLOYMENT_MODEL_PROVIDERS=amazon-bedrock`.

Without the opt-in, Bedrock stays hidden from signed-in accounts and runs fail with a `ProviderAuthRequiredError`. Before this change, a run could silently fall back to whatever AWS credentials the server had.
