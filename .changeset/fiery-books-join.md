---
'@mastra/dynamodb': patch
---

Adds configurable TTL (Time To Live) support for the @mastra/dynamodb store, enabling automatic data expiration for different entity types. This feature allows users to configure per-entity TTL settings for cost optimization, data lifecycle management, and compliance requirements.
Key changes:
Added ttl configuration option to DynamoDBStoreConfig with per-entity settings
Implemented TTL utility functions for calculating and applying TTL values
Updated all entity schemas (thread, message, resource, trace, eval, workflow_snapshot, score) to support TTL attributes
Added comprehensive test suite for TTL functionality
Updated documentation with usage examples and AWS setup instructions
