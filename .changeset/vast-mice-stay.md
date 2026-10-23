---
'@mastra/server-adapters-test-suite': patch
'@mastra/tanstack-start': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/client-js': patch
'@mastra/hono': patch
'@mastra/next': patch
'@mastra/koa': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Dataset and processor errors now include the id of the missing or failing resource in `details`: `experimentId` for `EXPERIMENT_NOT_FOUND`, `itemId` for `DATASET_ITEM_NOT_FOUND`, `processorId` for `PROCESSOR_WORKFLOW_FAILED`, and `field` for `DATASET_ITEM_EXTERNAL_ID_INVALID`. The server forwards these as the error's `metadata`.
