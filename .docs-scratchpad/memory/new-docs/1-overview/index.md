# Overview of Memory in Mastra

## What is Memory?

Memory in the context of AI agents refers to the context window - the information available to the language model when generating responses. In Mastra, memory enables:

- Maintaining conversation context across multiple turns
- Recalling information from past interactions
- Storing persistent user information and preferences
- Providing agents with the right context to generate relevant responses

## Types of Memory

Mastra implements several memory types to handle different needs:

### Short-Term Memory
Information relevant only to the current conversation, such as recent messages. This memory provides immediate context for the agent's responses.

### Long-Term Memory
Information that persists across conversation sessions, like user preferences, important facts, and recurring topics. This is implemented through:
- **Thread Storage**: Persistent storage of conversation history
- **Semantic Search**: Ability to find and recall relevant past messages
- **Working Memory**: XML-based storage of continuously relevant user data

## Mastra Memory Architecture

Mastra's memory system consists of several components working together:

```text
┌───────────────────────────────────────────────────────────────────────┐
│                        MASTRA MEMORY SYSTEM                            │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
          ┌─────────────────────────────────────────────┐
          │              Memory Instance                 │
          └─────────────────────────────────────────────┘
                │                 │                │
                ▼                 ▼                ▼
┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Storage Backend   │  │   Vector Store   │  │    Embedder      │
│  ----------------  │  │  --------------  │  │  --------------  │
│  • LibSQL          │  │  • PgVector      │  │  • FastEmbed     │
│  • PostgreSQL      │  │  • LibSQLVector  │  │  • OpenAI        │
│  • Upstash Redis   │  │  • Pinecone      │  │  • Cohere        │
└────────────────────┘  └──────────────────┘  └──────────────────┘
        │                        │                      │
        └────────────┬───────────┴──────────┬──────────┘
                     │                      │
        ┌────────────▼──────────┐  ┌────────▼────────────┐
        │  Message Management   │  │ Semantic Processing │
        │  ------------------   │  │ ------------------  │
        │  • Thread Storage     │  │  • Vector Indexing  │
        │  • Message Storage    │  │  • Similarity Search│
        │  • Working Memory     │  │  • Query Processing │
        └─────────────────────┬─┘  └────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│      Context Window     │      │    Response Generation   │
│      --------------     │      │    ------------------    │
│  • Last Messages        │      │  • Text Stream           │
│  • Semantic Results     │◄────►│  • Working Memory Update │
│  • Working Memory       │      │  • Message Storage       │
└─────────────────────────┘      └─────────────────────────┘
```

- **Memory Instance**: Central configuration point for all memory components
- **Storage Backend**: Persists conversation data in your chosen database (LibSQL, PostgreSQL, Upstash)
- **Vector Store**: Specialized database for semantic search capabilities
- **Embedder**: Converts text to vector representations for similarity search
- **Message Management**: Handles thread and message operations
- **Semantic Processing**: Performs vector indexing and similarity matching
- **Context Window**: Assembles relevant information for the agent
- **Response Generation**: Produces agent responses and updates memory

This architecture allows for flexibility in:
- Storage backends (LibSQL, PostgreSQL, Upstash)
- Embedding models (FastEmbed by default, OpenAI, etc.)
- Memory retrieval strategies (recency, semantic similarity)

Continue to [Getting Started](../2-getting-started/index.md) to learn how to implement memory in your Mastra agents. 