---
'@mastra/core': patch
---

fix: correct workflow chunk unwrapping and writer stream locking in network execution

  - Fix MastraAgentNetworkStream to properly unwrap workflow subchunks in parallel
  execution
  - Adjust watch-v2 event handling to prevent execution steps from starting with locked
  writer streams
  - Ensure proper chunk type propagation through network stream for agents in parallel
  workflows

  Changes resolve uncaught stream errors when agents are invoked within parallel workflow
   steps
  by correctly extracting inner chunks and preventing writer stream conflicts.

  test: add comprehensive test coverage for parallel workflow agent streaming
  - Verify all stream events are properly typed and sequenced
  - Validate text delta assembly and chunk propagation
  - Ensure no writer stream locking issues occur
