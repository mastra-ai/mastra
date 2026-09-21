---
'@mastra/connect': patch
---

Extended the platform proxy runtime and provider generator to support more Nango template patterns: the proxy context now implements the template SDK's `zodValidateInput` helper, and templates that read `connection.credentials` have their `getConnection()` calls rewritten to a new `getConnectionWithCredentials()` method that fetches the raw credential from the platform (the same endpoint `credential()` uses) and maps it to the template wire shape. Execs that don't read credentials continue to receive a credential-free connection context. The generator also gained an exclusion list for upstream template actions that emit uncompilable code.
