---
'@mastra/core': patch
'@mastra/agent-builder': patch
'@mastra/longmemeval': patch
---

Updated the AI SDK v5 compatibility dependencies so they resolve @ai-sdk/provider-utils 3.0.42, which blocks `.internal` hostnames in download URL validation and encodes provider-returned identifiers in request paths. This patch-level update replaces 3.0.41 (Aikido findings AIKIDO-2026-10990 and AIKIDO-2026-10981): ai 5.0.282, @ai-sdk/gateway 2.0.173, anthropic 2.0.110, google 2.0.106, groq 2.0.59, openai 2.0.137, openai-compatible 1.0.59, and xai 2.0.100.
