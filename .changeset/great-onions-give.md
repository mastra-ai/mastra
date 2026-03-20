---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added agent version support for experiments. When triggering an experiment, you can now pass an `agentVersion` parameter to pin which agent version to use. The agent version is stored with the experiment and returned in experiment responses.
