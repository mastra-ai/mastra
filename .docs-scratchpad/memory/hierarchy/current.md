# Mastra Memory Documentation - Current Information Hierarchy

## Reference Documentation (`/reference/memory/`)

### Core Memory Documentation
- **Memory.mdx** - Main Memory class reference
  - Basic usage examples
  - Custom configuration
  - Parameters and options
  - Working memory features

### Thread Management
- **createThread.mdx** - Creating conversation threads
- **getThreadById.mdx** - Retrieving specific threads
- **getThreadsByResourceId.mdx** - Getting all threads for a resource

### Message Management
- **query.mdx** - Retrieving and filtering messages
  - Recent message history
  - Semantic search options
  - Pagination and filtering

### Advanced Features
- **memory-processors.mdx** - Filtering and transforming messages
  - TokenLimiter processor
  - ToolCallFilter processor
  - Creating custom processors

## Agent Memory Guide (`/agents/agent-memory.mdx`)
- **Concepts and Organization**
  - Threads and Resources
  - Managing Conversation Context
  
- **Memory Features**
  - Recent Message History
  - Semantic Search
  - Working Memory

- **Configuration Options**
  - Basic Configuration
  - Custom Configuration
  - Overriding Memory Settings

- **Storage Options**
  - LibSQL Storage
  - PostgreSQL Storage
  - Upstash KV Storage

- **Vector Search**
  - Setting up vector stores
  - Configuring embeddings
  - Semantic search parameters

- **Memory Usage in Agents**
  - Automatic memory management
  - Integration with useChat()
  - Manual thread management

- **Working Memory**
  - Template structure
  - Automatic updates with XML tags
  - Handling memory updates in streaming

## Examples
- **memory-todo-agent** - Todo list with working memory
- **memory-with-context** - Maintaining conversation context
- **streaming-working-memory-advanced** - Advanced working memory example

## Current Information Gaps and Suggestions
- No clear entry point for beginners to understand memory
- Advanced features (processors) only in reference docs
- Limited examples of custom memory storage configurations
- Working memory documentation split across multiple locations 