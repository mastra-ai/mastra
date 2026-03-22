### Problem Statement

- Current tool calls and sub-agents are fully blocking operations
- Conversations cannot continue while tools, agent-as-tool, or workflows are
  executing
- Need ability for agents to run tasks in background while maintaining
  conversation flow

### Proposed Solution: Non-Blocking Background Tasks

- Enable agents to execute certain calls in background instead of foreground
- Allow conversation to continue while tools, sub-agents or workflows run in
  background
- Similar to Claude Code's approach: spinning up multiple sub-agents that report
  back to main thread while allowing continued interaction

### Claude Code Reference Implementation

- Spins up multiple agents (e.g., three for different code sections) that run in
  parallel
- Notifies user about sub-agents being launched while keeping conversation
  active
- Sub-agents write messages to main thread as they complete
- Returns to synchronous blocking mode when ready to synthesize results

### API Design Considerations (Part A)

- Need flexible configuration options for different use cases
- Message handling options: write all messages, only final message, or stream
  events to UI
- Tool-level configuration: specify which tools can run in background
- Agent awareness: how agents know background execution is available
- Configuration mechanism: how to enable background job capability

### Implementation & Infrastructure Considerations (Part B)

- Execution engine design: potentially use job queue system
- Scaling concerns: prevent unlimited parallel execution (e.g., 100,000 trees)
- Adapter pattern similar to storage: support different backends for different
  environments
- Options include: Redis for queuing, in-memory for local development, other
  queue systems, or leveraging workflows
- Must fit production-ready setup requirements
