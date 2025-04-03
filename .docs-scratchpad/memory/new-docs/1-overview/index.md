# What is Memory?

For agents, Memory is an automated system that manages which information the LLM can use to generate each new response. Think of it as the agent's "active awareness" - what it can consider and access when responding to you.

## The Context Window: An Agent's View of the Conversation

The context window is the "window" of information visible to the language model at any given time. Anything outside this window is inaccessible to the model when generating its response.

The context window consists of several key elements organized in a specific way:

1. **System Instructions**: Directives that guide the agent's behavior and personality
2. **Message History**: An ordered list of messages in turn-based format (user, assistant, user, assistant, etc.) including both text messages and tool calls
3. **Current User Message**: The most recent input that the agent needs to respond to

Each time your agent generates a response, it analyzes the entire context window and produces an appropriate response, which is then added to the message history for future interactions.

Before each interaction, memory logic determines which data should be added to the context window for the current request. The relevancy of each piece of data is determined by different memory features like semantic recall, message history, and working memory, but we'll come back to that later in the docs.

## Why use Memory?

With memory, your agent can:

- Maintain conversation context across multiple turns ("I mentioned my dog earlier, do you have any breed-specific training tips?")
- Recall information from past interactions ("What was that restaurant you recommended last week?")
- Remember tool calls it made and their results ("Based on the weather data I retrieved earlier...")
- Store persistent user information and preferences ("I don't like olives, don't recommend recipes with olives.")

### Example: Memory in a Conversation

**Without Memory:**

```
→ User: My name is Jamie, I live in Toronto.
← Agent: Nice to meet you, Jamie!
→ User: What's the weather like near me?
← Agent: I don't know where you're located. Could you please share your location?
```

**With Memory:**

```
→ User: My name is Jamie, I live in Toronto.
← Agent: Nice to meet you, Jamie!
→ User: What's the weather like near me?
⚡ Tool: checkWeather("Toronto")
← Agent: Based on the weather data, it's currently 18°C and partly cloudy in Toronto, Jamie.

[The next day...]

→ User: What's the weather like today?
⚡ Tool: checkWeather("Toronto")
← Agent: In Toronto today, it's 22°C and sunny. Looks like it's warmer than yesterday!
```

## Types of Memory

Memory can be broadly categorized into two main types:

*   **Short-Term Memory:** Information relevant only to the current conversation, such as recent messages. This memory provides immediate context for the agent's responses.
*   **Long-Term Memory:** Information that persists across conversation sessions, like user preferences, important facts, and recurring topics.
*   **Working Memory:** A specific implementation that provides a structured way to maintain continuously relevant information across conversation turns. This will be covered in more detail in a later section.

## Mastra Memory Architecture

Mastra provides a comprehensive memory system with two key aspects: how it processes requests and what components make it work.

### Memory Request Flow

Here's how the memory system processes a typical user request to assemble the context window for the LLM:

```text
        ┌─────────────────┐
        │  User Message   │
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │ Mastra Agent    │
        └────────┬────────┘
                 │ invokes with
                 │ resourceId + threadId
                 ▼
    ┌───────────────────────────┐
    │   Memory System           │
    │   (Retrieval Logic)       │
    └───────────┬───────────────┘
                │ determines context from...
   ┌────────────┼────────────────┬───────────────┐
   │            │                │               │
   ▼            ▼                ▼               ▼
┌─────────┐ ┌───────────┐ ┌─────────────────┐ ┌───────────┐
│ Storage │ │ Vector    │ │ Working Memory  │ │ System    │
│ Backend │ │ Store     │ │ Store           │ │ Prompt    │
│ (Recent │ │ (Semantic │ │ (Relevant Data) │ │           │
│ History)│ │ Recall)   │ │                 │ │           │
└─────────┘ └───────────┘ └─────────────────┘ └───────────┘
      │            │                │               │
      └────────────┼────────────────┴───────────────┘
                   │ assembles raw data
                   ▼
      ┌───────────────────────────┐
      │ Memory Processors         │
      │ ----------------------    │
      │ • Token Limiting          │
      │ • Tool Call Filtering     │
      │ • Custom Transformations  │
      └───────────┬───────────────┘
                  │ filters and optimizes
                  ▼
     ┌───────────────────────────┐
     │ Final Context Window      │
     │ ------------------------- │
     │ - System Prompt           │
     │ - Working Memory Data     │
     │ - Semantic Search Results │
     │ - Recent Message History  │
     │ - Current User Message    │
     └───────────┬───────────────┘
                 │ sent to
                 ▼
        ┌─────────────────┐
        │ LLM Provider    │
        └────────┬────────┘
                 │ returns response
                 ▼
        ┌─────────────────┐
        │ Mastra Agent    │
        └────────┬────────┘
                 │ 1. Sends response to user
                 │ 2. Triggers memory update
        ┌────────┴────────┐
        ▼                 ▼
┌─────────────────────┐   ┌───────────────────────┐
│ User Interface      │   │ Memory System         │
│ (Displays Responses)│   │ (Updates Logic)       │
└─────────────────────┘   │ ---------------       │
                          │ Store User Message    │
                          │ Store Agent Response  │
                          │ Update Working Memory │
                          │ (if any)              │
                          └───────────────────────┘
```

### Architecture Components

Mastra's memory system consists of several components working together:

```text
┌───────────────────────────────────────────────────────────────────────┐
│                        MASTRA MEMORY SYSTEM                           │
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
│  • + more          │  │  • + more        │  │  • + more        │
└────────────────────┘  └──────────────────┘  └──────────────────┘
        │                        │                      │
        └────────────┬───────────┴──────────┬───────────┘
                     │                      │
        ┌────────────▼──────────┐  ┌────────▼────────────┐
        │  Message Management   │  │ Semantic Processing │
        │  ------------------   │  │ ------------------  │
        │  • Thread Storage     │  │  • Vector Indexing  │
        │  • Message Storage    │  │  • Similarity Search│
        │  • Working Memory     │  │  • Query Processing │
        └─────────────────────┬─┘  └─────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│      Context Window     │      │    Response Generation   │
│      --------------     │      │    ------------------    │
│  • Last Messages        │      │  • Text Stream           │
│  • Semantic Results     │◄────►│  • Working Memory Update │
│  • Working Memory       │      │  • Message Storage       │
└─────────────────────────┘      └──────────────────────────┘
```

- **Memory Instance**: Central configuration point for all memory components. Memory is segmented by resourceId (user) and threadId (conversation), ensuring proper isolation between different users and chats.
- **Storage Backend**: Persists conversation data in your chosen database (LibSQL, PostgreSQL, Upstash)
- **Vector Store**: Specialized database for semantic search capabilities
- **Embedder**: Converts text to vector representations for similarity search
- **Message Management**: Handles conversation persistence (`Thread Storage`, `Message Storage`) and manages dynamic contextual data (`Working Memory`)
- **Semantic Processing**: Creates searchable representations of messages (`Vector Indexing`) and retrieves relevant information based on queries (`Similarity Search`, `Query Processing`)
- **Context Window**: Assembles relevant information for the agent
- **Response Generation**: Produces agent responses and updates memory

This architecture allows for flexibility in:

- Storage backends (LibSQL, PostgreSQL, Upstash)
- Embedding models (FastEmbed by default, OpenAI, etc.)
- Memory retrieval strategies (recency, semantic similarity)

Now that you understand what memory is and how it works in Mastra, you're ready to implement it in your own agents.

Continue to [Getting Started](../2-getting-started/index.md) to learn how to implement memory in your Mastra agents.

