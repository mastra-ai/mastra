# Memory-Augmented RAG

**Use Case**: Using memory to enhance Retrieval-Augmented Generation (RAG) processes.

**Why Users Need This**:
- Improve the quality of generated responses
- Reduce the need for external data sources
- Enable context-aware generation
- Locate specific information discussed in long conversations
- Connect related information across multiple sessions
- Build agents with long-term memory of past interactions

**Implementation Example**:
```typescript
const agent = new Agent({
  memory: new Memory({
    options: {
      semanticRecall: {
        topK: 5,         // Retrieve 5 most relevant past messages
        messageRange: 2, // Include context around each result
      }
    }
  }),
});

// Agent will find semantically similar past messages
await agent.stream("What did we decide about the API design last week?", {
  threadId: "project_planning",
  resourceId: "team_alpha",
});
``` 