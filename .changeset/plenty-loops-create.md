---
'@mastra/core': patch
---

Fixed gs:// and s3:// file/image references being downloaded and corrupted into data: URIs during durable agent execution. The durable LLM step now forwards the model's supportedUrls (matching standard execution), so URLs a provider fetches natively (e.g. Vertex gs://) pass through as references instead of failing with "Failed to download asset" or being base64-wrapped.
