---
'@mastra/factory': patch
---

**Settings › Tools** can now list each Mastra Connect connection's tools. The new `GET /web/integrations/platform/connect-tools/tools` route resolves the tools a session started by the signed-in user would get: Factory's default Connect tools, or what the `tools` option returns. It marks tools that ask for approval and lists the default tools Factory leaves out because they delete or archive. When the tools can't be resolved, it answers 502 `tools_unavailable` with the reason.
