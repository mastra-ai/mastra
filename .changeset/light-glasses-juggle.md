---
'@mastra/core': patch
---

Fixed a security issue where the framework-managed auth bearer token (`mastra__authToken`) was persisted in cleartext in workflow snapshots, score rows, and durable agent workflow inputs. The token is now excluded from all durable persistence; resumed authenticated requests use their own fresh live token. Fixes https://github.com/mastra-ai/mastra/issues/21975
