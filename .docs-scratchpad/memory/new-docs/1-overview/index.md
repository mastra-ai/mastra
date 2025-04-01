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

```
┌───────────────┐    ┌──────────────┐    ┌───────────────┐
│   Agent API   │───►│  Memory API  │───►│  Storage API  │
└───────────────┘    └──────────────┘    └───────────────┘
                           │  ▲                   ▲
                           ▼  │                   │
                     ┌──────────────┐    ┌───────────────┐
                     │ Vector Store │◄───┤  Embeddings   │
                     └──────────────┘    └───────────────┘
```

- **Agent API**: The entry point for interaction with your Mastra agents
- **Memory API**: Manages storage, retrieval, and processing of memory
- **Storage API**: Persists conversation data in your chosen database
- **Vector Store**: Enables semantic search of past messages
- **Embeddings**: Converts text to vector representations for similarity search

This architecture allows for flexibility in:
- Storage backends (LibSQL, PostgreSQL, Upstash)
- Embedding models (FastEmbed by default, OpenAI, etc.)
- Memory retrieval strategies (recency, semantic similarity)

Continue to [Getting Started](../2-getting-started/index.md) to learn how to implement memory in your Mastra agents. 