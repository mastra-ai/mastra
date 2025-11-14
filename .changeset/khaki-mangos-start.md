---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction.
