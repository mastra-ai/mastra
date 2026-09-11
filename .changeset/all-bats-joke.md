---
'@mastra/core': patch
---

Sampling settings that a model does not accept are now left out of the request for models passed in directly and for models hosted on Amazon Bedrock. Previously these settings were only removed for models referenced by name, so directly-passed and Bedrock-hosted models could fail their requests. Fixes #23319.
