# Plan

## RAG docs

- /docs/v1/rag/chunking-and-embedding
  - ❓ what does `modelName` do and should that be a model router string?
  - review Configuring Embedding Dimensions
    - the Google example doesn't use ModelRouterEmbeddingModel and may be invalid
    - consider moving dimensions examples into /models/v1/embeddings
  - review Vector Database Compatibility
    - ❓ do you need to do this even if you don't tweak the embedding dimension (as explained above)?
    - Example: Complete Pipeline
      - use a tab component for each provider
- /docs/v1/rag/vector-databases
  - Supported Databases
    - the "vector database index must be configured to match the output size of your embedding model" note could go here
  - Update all "Important" notices to use Docusarus admonition
  - ❓ do we need Naming Rules for Databases, or is this covered elsewhere?
  - Adding Metadata
    - ❓ if this is so important why only mention it here?
  - ❓ Does Deleting belong here?
- /docs/v1/rag/retrieval
  - ❓ should the `vectorQueryTool` have a name etc. then the subsequent explainer won't be necessary
  - Vector Store Prompt is "required" for filtering but not co-located with filteing. ❓ is this metadata filtering?
  - Rename `MastraAgentRelevanceScorer` to `MastraRelevanceScorer`?
  - add imports for createVectorQueryTool and throughout

- ❓ where do you do RAG? i guess in a tool
- ❓ how do you choose between the different providers?
- ❓ when do I use RAG and when do I use a simple database query?
- ❓ fastembed is referenced under semantic memory. should it work here as well?

## RAG examples

- examples/v1/rag/embedding/metadata-extraction
  - neither extractMetadata or getMetadata are documented elsewhere
  - probably move to /docs/v1/rag/retrieval?
- examples/v1/rag/query/hybrid-vector-search
  - already covered in /docs/v1/rag/retrieval#metadata-filtering
  - update /docs/v1/rag/retrieval#metadata-filtering to include the keyword "hybrid vector search"
- examples/v1/rag/usage/cleanup-rag
  - createDocumentChunker tool not documented. document in /docs/v1/rag/chunking-and-embedding
  - move to mastra-ai/mastra/examples
- examples/v1/rag/usage/filter-rag
  - the `nested` property for `chunk.map` isn't documented anywhere
  - move to msatra-ai/mastra/examples
- examples/v1/rag/usage/cot-rag
  - move to mastra-ai/mastra/examples
- examples/v1/rag/usage/cot-workflow-rag
  - extremely outdated
- examples/v1/rag/usage/graph-rag
  - createGraphRAGTool isn't documented anywhere
  - turn this into a new page:docs/v1/rag/graph-rag
- examples/v1/rag/usage/database-specific-config
  - move to mastra-ai/mastra/examples
- Storage
  - explain
- /reference/v1/rag/chunk
  - Remove "Reference:" from the title
- docs/v1/server-db/server-adapters
  - add "New" label

the next task is to update RAG examples. the goal is ultimately to remove all examples.

start with examples/rag/embedding/metadata-extraction
