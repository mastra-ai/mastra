---
'@mastra/core': patch
---

Fixed image and file URLs returned from a tool's toModelOutput being corrupted before reaching the model. Remote image-url and file-url tool results were rewritten into a media part with the URL stuffed into the Base64-only data field, and their providerOptions were dropped. URL parts are now preserved as-is and converted to the correct shape for the target model's specification version (image-url/file-url for v3 models, url-tagged file parts for v4 models). Messages persisted by older versions with a URL in the media data field are healed the same way, and Mastra's internal modelOutput metadata is no longer leaked to providers in the outgoing prompt. Fixes https://github.com/mastra-ai/mastra/issues/22618
