# Knowledge Retention with Working Memory

**Use Case**: Remembering important user information, preferences, and context without keeping full conversation history.

**Why Users Need This**:
- Maintain personalization with minimal context
- Reduce token usage while preserving key information
- Store structured data alongside conversations

**Implementation Example**:
```typescript
const agent = new Agent({
  memory: new Memory({
    options: {
      lastMessages: 5, // Short context window
      workingMemory: {
        enabled: true,
        template: `<user>
  <preferences>
    <language>English</language>
    <units>metric</units>
    <communication_style>brief</communication_style>
  </preferences>
  <profile>
    <role>developer</role>
    <experience_level>intermediate</experience_level>
    <interests>TypeScript, React, AI</interests>
  </profile>
</user>`,
      },
    }
  }),
});
``` 