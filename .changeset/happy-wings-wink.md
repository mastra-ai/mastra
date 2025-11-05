---
'@mastra/mssql': minor
---

Implemented tracing and observability features

- Added createAISpan, updateAISpan, getAITrace, getAITracesPaginated
- Added batchCreateAISpans, batchUpdateAISpans, batchDeleteAITraces
- Automatic performance indexes for AI spans

Implemented workflow update methods

- Added updateWorkflowResults with row-level locking (UPDLOCK, HOLDLOCK)
- Added updateWorkflowState with row-level locking
- Concurrent update protection for parallel workflow execution

Added index management API

- Added createIndex, listIndexes, describeIndex, dropIndex methods
- Exposed index management methods directly on store instance
- Support for composite indexes, unique constraints, and filtered indexes

Documentation improvements

- Comprehensive README with complete API reference (58 methods)
- Detailed feature descriptions for all storage capabilities
- Index management examples and best practices
- Updated to reflect all atomic transaction usage