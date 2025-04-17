# @mastra/memory

## 0.3.0-alpha.4

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 0.2.11-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 0.2.11-alpha.2

### Patch Changes

- 5c6825c: [MASTRA-2782] removed tiktoken from memory chunktext

## 0.2.11-alpha.1

### Patch Changes

- 6f92295: Fixed an issue where some user messages and llm messages would have the exact same createdAt date, leading to incorrect message ordering. Added a fix for new messages as well as any that were saved before the fix in the wrong order
- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 0.2.11-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 0.2.10

### Patch Changes

- f6f7345: Added missing createdAt field to UI messages in memory
- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 0.2.10-alpha.5

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 0.2.10-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 0.2.10-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 0.2.10-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 0.2.10-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 0.2.10-alpha.0

### Patch Changes

- f6f7345: Added missing createdAt field to UI messages in memory
- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false
- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 0.2.9

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 0.2.9-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 0.2.8

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 0.2.8-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 0.2.7

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg
- 3e72f94: Updated the internal working memory system to use MD for formatting instead of nested XML - this is more token efficient and makes it more obvious that it's unstructured text
- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- 0118361: Add resourceId to memory metadata
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0

## 0.2.7-alpha.8

### Patch Changes

- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.2.7-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.2.7-alpha.6

### Patch Changes

- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.2.7-alpha.5

### Patch Changes

- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg
- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.2.7-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/rag@0.1.15-alpha.4

## 0.2.7-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 3e72f94: Updated the internal working memory system to use MD for formatting instead of nested XML - this is more token efficient and makes it more obvious that it's unstructured text
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/rag@0.1.15-alpha.3

## 0.2.7-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/rag@0.1.15-alpha.2

## 0.2.7-alpha.1

### Patch Changes

- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- 0118361: Add resourceId to memory metadata
- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [e47f529]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/rag@0.1.15-alpha.1

## 0.2.7-alpha.0

### Patch Changes

- 7599d77: fix(deps): update ai sdk to ^4.2.2
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0
  - @mastra/rag@0.1.15-alpha.0

## 0.2.6

### Patch Changes

- 05095e9: Fixed an issue where very long messages would cause Memory semantic recall to throw errors
- 394dfad: Removed working memory tool calls from thread history after the working memory has been updated. This is to prevent updates from polluting the context history and confusing agents. They should only see the most recent copy of working memory.
  Also made memory.getWorkingMemory() public since it's useful for testing, debugging, and building UIs.
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0
  - @mastra/rag@0.1.14

## 0.2.6-alpha.4

### Patch Changes

- 394dfad: Removed working memory tool calls from thread history after the working memory has been updated. This is to prevent updates from polluting the context history and confusing agents. They should only see the most recent copy of working memory.
  Also made memory.getWorkingMemory() public since it's useful for testing, debugging, and building UIs.

## 0.2.6-alpha.3

### Patch Changes

- 05095e9: Fixed an issue where very long messages would cause Memory semantic recall to throw errors
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3
  - @mastra/rag@0.1.14-alpha.3

## 0.2.6-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2

## 0.2.6-alpha.1

### Patch Changes

- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1

## 0.2.6-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.2.5

### Patch Changes

- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.2.5-alpha.1

### Patch Changes

- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.2.5-alpha.0

### Patch Changes

- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.2.4

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.2.3

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.2.3-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.2.2

### Patch Changes

- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1

## 0.2.2-alpha.2

### Patch Changes

- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.2.2-alpha.1

### Patch Changes

- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.2.1

### Patch Changes

- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()
- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0

## 0.2.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.

### Patch Changes

- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0

## 0.2.0-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.2.0-alpha.11

### Patch Changes

- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.2.0-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.2.0-alpha.9

### Patch Changes

- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.
- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9

## 0.2.0-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8

## 0.2.0-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7

## 0.2.0-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6

## 0.2.0-alpha.5

### Patch Changes

- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5

## 0.2.0-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.2.0-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3

## 0.2.0-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.7

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.7-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.6

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.5

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.4

### Patch Changes

- ce44b9b: Fixed a bug where embeddings were being created for memory even when semanticRecall was turned off
- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.1

### Patch Changes

- 91ef439: Add eslint and ran autofix
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1

## 0.1.1-alpha.0

### Patch Changes

- 91ef439: Add eslint and ran autofix
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0

## 0.1.0

### Minor Changes

- 5916f9d: Update deps from fixed to ^
- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes
- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)
- cb290ee: Reworked the Memory public API to have more intuitive and simple property names
- 8b416d9: Breaking changes
- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses

### Patch Changes

- 8ae2bbc: Dane publishing
- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding
- bdaf834: publish packages
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- b97ca96: Tracing into default storage
- 033eda6: More fixes for refactor
- 0b74006: Workflow updates
- 3220d26: Fix lastStep error in agent stream
- 9c10484: update all packages
- 70dabd9: Fix broken publish
- c35aa18: bug: not all models support multiple system messages
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- b898fad: Fix get context window in memory
- 002d6d8: add memory to playground agent
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config
- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed
- 7f5b1b2: @mastra/memory tsup bundling
- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- b5393f1: New example: Dane and many fixes to make it work
- 67637ba: Fixed storage bugs related to the new Memory API
- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core
- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory
- 4f1d1a1: Enforce types ann cleanup package.json
- ee4de15: Dane fixes
- Updated dependencies [f537e33]
- Updated dependencies [6f2c0f5]
- Updated dependencies [e4d4ede]
- Updated dependencies [0be7181]
- Updated dependencies [dd6d87f]
- Updated dependencies [9029796]
- Updated dependencies [6fa4bd2]
- Updated dependencies [f031a1f]
- Updated dependencies [8151f44]
- Updated dependencies [d7d465a]
- Updated dependencies [4d4f6b6]
- Updated dependencies [73d112c]
- Updated dependencies [592e3cf]
- Updated dependencies [9d1796d]
- Updated dependencies [e897f1c]
- Updated dependencies [4a54c82]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [e9d1b47]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [d5e12de]
- Updated dependencies [e1dd94a]
- Updated dependencies [07c069d]
- Updated dependencies [5cdfb88]
- Updated dependencies [837a288]
- Updated dependencies [685108a]
- Updated dependencies [c8ff2f5]
- Updated dependencies [5fdc87c]
- Updated dependencies [ae7bf94]
- Updated dependencies [8e7814f]
- Updated dependencies [66a03ec]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [1874f40]
- Updated dependencies [685108a]
- Updated dependencies [f7d1131]
- Updated dependencies [79acad0]
- Updated dependencies [7a19083]
- Updated dependencies [382f4dc]
- Updated dependencies [1ebd071]
- Updated dependencies [0b74006]
- Updated dependencies [2f17a5f]
- Updated dependencies [f368477]
- Updated dependencies [7892533]
- Updated dependencies [9c10484]
- Updated dependencies [b726bf5]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [176bc42]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [fe3dcb0]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [eedb829]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [f6da688]
- Updated dependencies [3700be1]
- Updated dependencies [9ade36e]
- Updated dependencies [10870bc]
- Updated dependencies [2b01511]
- Updated dependencies [a870123]
- Updated dependencies [ccf115c]
- Updated dependencies [04434b6]
- Updated dependencies [5811de6]
- Updated dependencies [9f3ab05]
- Updated dependencies [66a5392]
- Updated dependencies [4b1ce2c]
- Updated dependencies [14064f2]
- Updated dependencies [f5dfa20]
- Updated dependencies [327ece7]
- Updated dependencies [da2e8d3]
- Updated dependencies [95a4697]
- Updated dependencies [d5fccfb]
- Updated dependencies [3427b95]
- Updated dependencies [538a136]
- Updated dependencies [e66643a]
- Updated dependencies [b5393f1]
- Updated dependencies [d2cd535]
- Updated dependencies [c2dd6b5]
- Updated dependencies [67637ba]
- Updated dependencies [836f4e3]
- Updated dependencies [5ee2e78]
- Updated dependencies [cd02c56]
- Updated dependencies [01502b0]
- Updated dependencies [16e5b04]
- Updated dependencies [d9c8dd0]
- Updated dependencies [9fb59d6]
- Updated dependencies [a9345f9]
- Updated dependencies [99f1847]
- Updated dependencies [04f3171]
- Updated dependencies [8769a62]
- Updated dependencies [d5ec619]
- Updated dependencies [27275c9]
- Updated dependencies [ae7bf94]
- Updated dependencies [4f1d1a1]
- Updated dependencies [ee4de15]
- Updated dependencies [202d404]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0

## 0.1.0-alpha.92

### Patch Changes

- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- Updated dependencies [016493a]
- Updated dependencies [382f4dc]
- Updated dependencies [176bc42]
- Updated dependencies [d68b532]
- Updated dependencies [fe3dcb0]
- Updated dependencies [e448a26]
- Updated dependencies [fd75f3c]
- Updated dependencies [ccf115c]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0-alpha.110

## 0.1.0-alpha.91

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109

## 0.1.0-alpha.90

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108

## 0.1.0-alpha.89

### Patch Changes

- Updated dependencies [66a5392]
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.88

### Patch Changes

- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
  - @mastra/core@0.2.0-alpha.106

## 0.1.0-alpha.87

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.86

### Patch Changes

- b97ca96: Tracing into default storage
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.85

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.84

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.83

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.82

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.81

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.80

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.79

### Patch Changes

- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.78

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.77

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.76

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.75

### Patch Changes

- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.74

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.73

### Minor Changes

- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91

## 0.1.0-alpha.72

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90

## 0.1.0-alpha.71

### Minor Changes

- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89

## 0.1.0-alpha.70

### Patch Changes

- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.69

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87

## 0.1.0-alpha.68

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- 67637ba: Fixed storage bugs related to the new Memory API
- Updated dependencies [6fa4bd2]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86

## 0.1.0-alpha.67

### Patch Changes

- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding
- Updated dependencies [e9d1b47]
  - @mastra/core@0.2.0-alpha.85

## 0.1.0-alpha.66

### Minor Changes

- cb290ee: Reworked the Memory public API to have more intuitive and simple property names

### Patch Changes

- Updated dependencies [2f17a5f]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84

## 0.1.0-alpha.65

### Minor Changes

- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes

### Patch Changes

- c35aa18: bug: not all models support multiple system messages
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/core@0.2.0-alpha.83

## 0.0.2-alpha.64

### Patch Changes

- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82

## 0.0.2-alpha.63

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81

## 0.0.2-alpha.62

### Patch Changes

- 7f5b1b2: @mastra/memory tsup bundling

## 0.0.2-alpha.61

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80

## 0.0.2-alpha.60

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79

## 0.0.2-alpha.59

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/core@0.1.27-alpha.78

## 0.0.2-alpha.58

### Patch Changes

- Updated dependencies [8105fae]
  - @mastra/core@0.1.27-alpha.77

## 0.0.2-alpha.57

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76

## 0.0.2-alpha.56

### Patch Changes

- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75

## 0.0.2-alpha.55

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74

## 0.0.2-alpha.54

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73

## 0.0.2-alpha.53

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72

## 0.0.2-alpha.52

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71

## 0.0.2-alpha.51

### Patch Changes

- bdaf834: publish packages

## 0.0.2-alpha.50

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70

## 0.0.2-alpha.49

### Patch Changes

- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69

## 0.0.2-alpha.48

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68

## 0.0.2-alpha.47

### Patch Changes

- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67

## 0.0.2-alpha.46

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66

## 0.0.2-alpha.45

### Patch Changes

- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65

## 0.0.2-alpha.44

### Patch Changes

- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64

## 0.0.2-alpha.43

### Patch Changes

- Updated dependencies [e097800]
  - @mastra/core@0.1.27-alpha.63

## 0.0.2-alpha.42

### Patch Changes

- Updated dependencies [93a3719]
  - @mastra/core@0.1.27-alpha.62

## 0.0.2-alpha.41

### Patch Changes

- Updated dependencies [dc90663]
  - @mastra/core@0.1.27-alpha.61

## 0.0.2-alpha.40

### Patch Changes

- Updated dependencies [3967e69]
  - @mastra/core@0.1.27-alpha.60

## 0.0.2-alpha.39

### Patch Changes

- Updated dependencies [b524c22]
  - @mastra/core@0.1.27-alpha.59

## 0.0.2-alpha.38

### Patch Changes

- Updated dependencies [1874f40]
- Updated dependencies [4b1ce2c]
  - @mastra/core@0.1.27-alpha.58

## 0.0.2-alpha.37

### Patch Changes

- Updated dependencies [fd494a3]
  - @mastra/core@0.1.27-alpha.57

## 0.0.2-alpha.36

### Patch Changes

- Updated dependencies [9f3ab05]
  - @mastra/core@0.1.27-alpha.56

## 0.0.2-alpha.35

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates
- Updated dependencies [592e3cf]
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - @mastra/core@0.1.27-alpha.55

## 0.0.2-alpha.34

### Patch Changes

- Updated dependencies [d2cd535]
  - @mastra/core@0.1.27-alpha.54

## 0.0.2-alpha.33

### Patch Changes

- Updated dependencies [8e7814f]
  - @mastra/core@0.1.27-alpha.53

## 0.0.2-alpha.32

### Patch Changes

- Updated dependencies [eedb829]
  - @mastra/core@0.1.27-alpha.52

## 0.0.2-alpha.31

### Patch Changes

- Updated dependencies [a7b016d]
- Updated dependencies [da2e8d3]
- Updated dependencies [538a136]
  - @mastra/core@0.1.27-alpha.51

## 0.0.2-alpha.30

### Patch Changes

- Updated dependencies [401a4d9]
  - @mastra/core@0.1.27-alpha.50

## 0.0.2-alpha.29

### Patch Changes

- Updated dependencies [79acad0]
- Updated dependencies [f5dfa20]
  - @mastra/core@0.1.27-alpha.49

## 0.0.2-alpha.28

### Patch Changes

- Updated dependencies [b726bf5]
  - @mastra/core@0.1.27-alpha.48

## 0.0.2-alpha.27

### Patch Changes

- Updated dependencies [f6ba259]
  - @mastra/core@0.1.27-alpha.47

## 0.0.2-alpha.26

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes
- Updated dependencies [8ae2bbc]
- Updated dependencies [0bd142c]
- Updated dependencies [ee4de15]
  - @mastra/core@0.1.27-alpha.46

## 0.0.2-alpha.25

### Patch Changes

- 3220d26: Fix lastStep error in agent stream

## 0.0.2-alpha.24

### Patch Changes

- 002d6d8: add memory to playground agent
- Updated dependencies [e608d8c]
- Updated dependencies [002d6d8]
  - @mastra/core@0.1.27-alpha.45

## 0.0.2-alpha.23

### Patch Changes

- Updated dependencies [2fa7f53]
  - @mastra/core@0.1.27-alpha.44

## 0.0.2-alpha.22

### Patch Changes

- Updated dependencies [2e099d2]
- Updated dependencies [d6d8159]
  - @mastra/core@0.1.27-alpha.43

## 0.0.2-alpha.21

### Patch Changes

- Updated dependencies [4a54c82]
  - @mastra/core@0.1.27-alpha.42

## 0.0.2-alpha.20

### Patch Changes

- Updated dependencies [5cdfb88]
  - @mastra/core@0.1.27-alpha.41

## 0.0.2-alpha.19

### Patch Changes

- Updated dependencies [9029796]
  - @mastra/core@0.1.27-alpha.40

## 0.0.2-alpha.18

### Patch Changes

- Updated dependencies [2b01511]
  - @mastra/core@0.1.27-alpha.39

## 0.0.2-alpha.17

### Patch Changes

- Updated dependencies [f031a1f]
  - @mastra/core@0.1.27-alpha.38

## 0.0.2-alpha.16

### Patch Changes

- b5393f1: New example: Dane and many fixes to make it work
- Updated dependencies [c872875]
- Updated dependencies [f6da688]
- Updated dependencies [b5393f1]
  - @mastra/core@0.1.27-alpha.37

## 0.0.2-alpha.15

### Patch Changes

- b898fad: Fix get context window in memory
- Updated dependencies [f537e33]
- Updated dependencies [bc40916]
- Updated dependencies [f7d1131]
- Updated dependencies [75bf3f0]
- Updated dependencies [3c4488b]
- Updated dependencies [d38f7a6]
  - @mastra/core@0.1.27-alpha.36

## 0.0.2-alpha.14

### Patch Changes

- 033eda6: More fixes for refactor
- Updated dependencies [033eda6]
  - @mastra/core@0.1.27-alpha.35

## 0.0.2-alpha.13

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- Updated dependencies [837a288]
- Updated dependencies [5811de6]
  - @mastra/core@0.1.27-alpha.34

## 0.0.2-alpha.12

### Patch Changes

- Updated dependencies [e1dd94a]
  - @mastra/core@0.1.27-alpha.33

## 0.0.2-alpha.11

### Patch Changes

- Updated dependencies [2712098]
  - @mastra/core@0.1.27-alpha.32

## 0.0.2-alpha.10

### Patch Changes

- Updated dependencies [c2dd6b5]
  - @mastra/core@0.1.27-alpha.31

## 0.0.2-alpha.9

### Patch Changes

- Updated dependencies [963c15a]
  - @mastra/core@0.1.27-alpha.30

## 0.0.2-alpha.8

### Patch Changes

- Updated dependencies [7d87a15]
  - @mastra/core@0.1.27-alpha.29

## 0.0.2-alpha.7

### Patch Changes

- Updated dependencies [1ebd071]
  - @mastra/core@0.1.27-alpha.28

## 0.0.2-alpha.6

### Patch Changes

- Updated dependencies [cd02c56]
  - @mastra/core@0.1.27-alpha.27

## 0.0.2-alpha.5

### Patch Changes

- Updated dependencies [d5e12de]
  - @mastra/core@0.1.27-alpha.26

## 0.0.2-alpha.4

### Patch Changes

- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory
- Updated dependencies [01502b0]
  - @mastra/core@0.1.27-alpha.25

## 0.0.2-alpha.3

### Patch Changes

- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core
- Updated dependencies [836f4e3]
  - @mastra/core@0.1.27-alpha.24

## 0.0.2-alpha.2

### Patch Changes

- Updated dependencies [0b826f6]
  - @mastra/core@0.1.27-alpha.23

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies [7a19083]
  - @mastra/core@0.1.27-alpha.22

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies [5ee2e78]
  - @mastra/core@0.1.27-alpha.21
