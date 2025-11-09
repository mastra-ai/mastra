# @mastra/aisearch

## 1.0.0-beta.0

### Major Changes

- Initial release of Azure AI Search vector store provider for Mastra
- Full vector storage and similarity search capabilities using Azure AI Search
- Support for cosine, euclidean, and dot product similarity metrics
- Comprehensive OData filter translation for Azure AI Search queries
- Type-safe filter construction with structured syntax
- Integration with Mastra's error handling and logging system

### Features

- **Vector Operations**: Create, upsert, query, update, and delete vectors
- **Index Management**: Create, list, describe, and delete vector indexes  
- **Advanced Filtering**: Support for complex OData filters with logical operations
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Authentication**: Support for API keys and Azure credential authentication
- **Error Handling**: Robust error handling with detailed error categories
- **Performance**: Optimized for batch operations and efficient querying

### Dependencies

- `@azure/search-documents`: ^12.0.0
- `@azure/core-auth`: ^1.7.2