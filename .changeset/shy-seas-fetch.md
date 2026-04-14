---
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Forward parent agent client tools to sub-agents in supervisor mode and make delegated client-tool suspend/resume robust across core, server, and the JS SDK. Sub-agents can now request parent client tools, suspend for client-side execution, and resume generate/stream flows with client tool results until the delegated run completes.
