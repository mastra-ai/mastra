---
'@mastra/server': patch
---

Fixed Swagger UI not including the API prefix (e.g., `/api`) in request URLs. The OpenAPI spec now includes a servers field with the configured prefix, so Swagger UI correctly generates URLs like `http://localhost:4111/api/agents` instead of `http://localhost:4111/agents`.
