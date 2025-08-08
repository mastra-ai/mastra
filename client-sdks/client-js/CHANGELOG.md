# @mastra/client-js

## 0.10.21-alpha.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- Updated dependencies [a239d41]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2

## 0.10.21-alpha.1

### Patch Changes

- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1

## 0.10.21-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0

## 0.10.20

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1

## 0.10.20-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0

## 0.10.19

### Patch Changes

- 42dfc48: Fix tool messages structure in agui adapter
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0

## 0.10.19-alpha.3

### Patch Changes

- Updated dependencies [d0496e6]
  - @mastra/core@0.13.0-alpha.3

## 0.10.19-alpha.2

### Patch Changes

- 42dfc48: Fix tool messages structure in agui adapter
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.10.19-alpha.1

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.10.19-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0

## 0.10.18

### Patch Changes

- 6690a16: dependencies updates:
  - Updated dependency [`@ag-ui/client@^0.0.35` ↗︎](https://www.npmjs.com/package/@ag-ui/client/v/0.0.35) (from `^0.0.27`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 0.10.18-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1

## 0.10.18-alpha.0

### Patch Changes

- 6690a16: dependencies updates:
  - Updated dependency [`@ag-ui/client@^0.0.35` ↗︎](https://www.npmjs.com/package/@ag-ui/client/v/0.0.35) (from `^0.0.27`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 0.10.17

### Patch Changes

- aa2715b: process stream response error handling
- 6bd354c: Should not send content type if body instance of FormData
- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- b641ba3: fix: save score params
- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- 1ac8f6b: deduplicate message
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0

## 0.10.17-alpha.5

### Patch Changes

- @mastra/core@0.12.0-alpha.5

## 0.10.17-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4

## 0.10.17-alpha.3

### Patch Changes

- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
- 1ac8f6b: deduplicate message
  - @mastra/core@0.12.0-alpha.3

## 0.10.17-alpha.2

### Patch Changes

- aa2715b: process stream response error handling
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2

## 0.10.17-alpha.1

### Patch Changes

- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1

## 0.10.17-alpha.0

### Patch Changes

- 6bd354c: Should not send content type if body instance of FormData
- b641ba3: fix: save score params
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0

## 0.10.16

### Patch Changes

- @mastra/core@0.11.1

## 0.10.15

### Patch Changes

- 4832752: Do not set content-type header when making POST/PUT requests without a body
- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 032cb66: ClientJS
- 7827943: Handle streaming large data
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- 6f6e651: Alias createRun -> createRunAsync to match Mastra Workflow class
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0

## 0.10.15-alpha.3

### Patch Changes

- @mastra/core@0.11.0-alpha.3

## 0.10.15-alpha.2

### Patch Changes

- 4832752: Do not set content-type header when making POST/PUT requests without a body
- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 032cb66: ClientJS
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- 6f6e651: Alias createRun -> createRunAsync to match Mastra Workflow class
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2

## 0.10.15-alpha.1

### Patch Changes

- @mastra/core@0.11.0-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 7827943: Handle streaming large data
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0

## 0.10.14

### Patch Changes

- 31f9f6b: Replace crypto randomUUID in client SDK"
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15

## 0.10.14-alpha.1

### Patch Changes

- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1

## 0.10.14-alpha.0

### Patch Changes

- 31f9f6b: Replace crypto randomUUID in client SDK"
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- Updated dependencies [db5cc15]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15-alpha.0

## 0.10.13

### Patch Changes

- @mastra/core@0.10.14

## 0.10.11

### Patch Changes

- 9468be4: Fix error on agent generate while using antropic
- 44731a4: Client SDK - Expose processTextStream util for agent textstream with structured output
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12

## 0.10.11-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- 9468be4: Fix error on agent generate while using antropic
- 44731a4: Client SDK - Expose processTextStream util for agent textstream with structured output
- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0

## 0.10.10

### Patch Changes

- 18da791: Add abortSignal to client SDK options
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11

## 0.10.10-alpha.4

### Patch Changes

- @mastra/core@0.10.11-alpha.4

## 0.10.10-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3

## 0.10.10-alpha.2

### Patch Changes

- 18da791: Add abortSignal to client SDK options
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2

## 0.10.10-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0

## 0.10.9

### Patch Changes

- b60f510: Fix getWorkflowRuns by limit and offset
- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10

## 0.10.9-alpha.1

### Patch Changes

- b60f510: Fix getWorkflowRuns by limit and offset
- 6997af1: add send event to server, deployer, client-js and playground-ui
  - @mastra/core@0.10.10-alpha.1

## 0.10.9-alpha.0

### Patch Changes

- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0

## 0.10.8

### Patch Changes

- 9047bda: clientTools - stream tool-result part
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9

## 0.10.8-alpha.0

### Patch Changes

- 9047bda: clientTools - stream tool-result part
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0

## 0.10.7

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/core@0.10.8-alpha.0

## 0.10.6

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 18a5d59: clientTools client side execution
- 5d74aab: vNext network in playground
- bee3fe4: Fix client side tool calling
- c0d41f6: Fix streaming for agent tool calls
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7

## 0.10.6-alpha.6

### Patch Changes

- c0d41f6: Fix streaming for agent tool calls

## 0.10.6-alpha.5

### Patch Changes

- bee3fe4: Fix client side tool calling
  - @mastra/core@0.10.7-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- 18a5d59: clientTools client side execution
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.10.5

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6

## 0.10.5-alpha.5

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5

## 0.10.5-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4

## 0.10.5-alpha.3

### Patch Changes

- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3

## 0.10.5-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.10.5-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [ee9af57]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6-alpha.1

## 0.10.5-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.4

### Patch Changes

- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5

## 0.10.3

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- f1f1f1b: Add basic filtering capabilities to logs
- b2810ab: Move @mastra/core to deps
- 82090c1: Add pagination to logs
- 67d21b5: Added overloading to the generate method of the Agent class to enhance type definition using ZodSchema.
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4

## 0.10.3-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.3-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2

## 0.10.3-alpha.1

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.3-alpha.0

### Patch Changes

- f1f1f1b: Add basic filtering capabilities to logs
- b2810ab: Move @mastra/core to deps
- 82090c1: Add pagination to logs
- 67d21b5: Added overloading to the generate method of the Agent class to enhance type definition using ZodSchema.
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0

## 0.10.2

### Patch Changes

- 592a2db: Added different icons for agents and workflows in mcp tools list
- 37643b8: Fix tool access
- c5bf1ce: Add backwards compat code for new MessageList in storage
- b72c768: [Bug fix] Serialize parameters in clientTools
- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2

## 0.10.2-alpha.3

### Patch Changes

- 37643b8: Fix tool access
- b72c768: [Bug fix] Serialize parameters in clientTools
- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.10.2-alpha.2

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.0

### Patch Changes

- 592a2db: Added different icons for agents and workflows in mcp tools list
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 5343f93: Move emitter to symbol to make private
- f622cfa: Make some properties of CreateMemoryThreadParams optional
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1

## 0.10.1-alpha.3

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream

## 0.10.1-alpha.2

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- f622cfa: Make some properties of CreateMemoryThreadParams optional
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- f53a6ac: Add VNextWorkflowRuns type
- ccdabdc: Remove trailing / from mastraClient baseUrl
- a6e3881: Remove non serializable options from agent stream,generate
- fddae56: Add telemetry to cliend SDK streamParams
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 5063646: Accept plain obects as runtimeContext
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0

## 0.2.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- 5063646: Accept plain obects as runtimeContext
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1

## 0.1.23-alpha.0

### Patch Changes

- f53a6ac: Add VNextWorkflowRuns type
- ccdabdc: Remove trailing / from mastraClient baseUrl
- a6e3881: Remove non serializable options from agent stream,generate
- fddae56: Add telemetry to cliend SDK streamParams
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 0.1.22

### Patch Changes

- c2f9e60: Resolves type issue and listen response string wrapped in text object twice
- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- b4c6c87: fix: Specify $refStrategy: 'none' when calling zodToJsonSchema.
- 0c3d117: Add workflows to agent server handlers
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable
- c2b980b: Fix multiple too-calls in AGUI
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4

## 0.1.22-alpha.4

### Patch Changes

- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 0.1.22-alpha.3

### Patch Changes

- c2f9e60: Resolves type issue and listen response string wrapped in text object twice
- 0c3d117: Add workflows to agent server handlers
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 0.1.22-alpha.2

### Patch Changes

- b4c6c87: fix: Specify $refStrategy: 'none' when calling zodToJsonSchema.
- c2b980b: Fix multiple too-calls in AGUI
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 0.1.22-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 0.1.22-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 0.1.21

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- 36eb1aa: Fix AGUI text part
- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3

## 0.1.21-alpha.1

### Patch Changes

- 36eb1aa: Fix AGUI text part
- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 0.1.21-alpha.0

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 0.1.20

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
  - Updated dependency [`zod-to-json-schema@^3.24.5` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.5) (from `^3.24.3`, in `dependencies`)
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 254f5c3: Audit, cleanup MastraClient
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 2429c74: Add get workflow runs api to client-js
- 2e4f8e9: Agui client integration
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2

## 0.1.20-alpha.6

### Patch Changes

- 2e4f8e9: Agui client integration
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 0.1.20-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 0.1.20-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 0.1.20-alpha.3

### Patch Changes

- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 0.1.20-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 0.1.20-alpha.1

### Patch Changes

- 254f5c3: Audit, cleanup MastraClient
- 2429c74: Add get workflow runs api to client-js
- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 0.1.20-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 0.1.19

### Patch Changes

- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1

## 0.1.19-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 0.1.19-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 0.1.19-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 0.1.19-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 0.1.19-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 0.1.19-alpha.3

### Patch Changes

- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 0.1.19-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 0.1.19-alpha.1

### Patch Changes

- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1

## 0.1.19-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0

## 0.1.18

### Patch Changes

- 2538066: Fix memory thread creation from client SDK
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0

## 0.1.18-alpha.8

### Patch Changes

- 2538066: Fix memory thread creation from client SDK
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8

## 0.1.18-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7

## 0.1.18-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6

## 0.1.18-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5

## 0.1.18-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4

## 0.1.18-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 0.1.18-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 0.1.18-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 0.1.18-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 0.1.17

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 0.1.17-alpha.5

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 0.1.17-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 0.1.17-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 0.1.17-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 0.1.17-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 0.1.17-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 0.1.16

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 0.1.16-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 0.1.15

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 0.1.15-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 0.1.14

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph
- 84fe241: Improve streaming of workflows
- 5646a01: Fix parsing chunk in client-js workflow watch method sometimes failing, disrupting the stream process
- bffd64f: Fix mastraClient CORS
- 8076ecf: Unify workflow watch/start response
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

## 0.1.14-alpha.8

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- bffd64f: Fix mastraClient CORS
- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.1.14-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.1.14-alpha.6

### Patch Changes

- 5646a01: Fix parsing chunk in client-js workflow watch method sometimes failing, disrupting the stream process
- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.1.14-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.1.14-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4

## 0.1.14-alpha.3

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph
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

## 0.1.14-alpha.2

### Patch Changes

- 84fe241: Improve streaming of workflows
- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2

## 0.1.14-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1

## 0.1.14-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0

## 0.1.13

### Patch Changes

- 0206617: Fix mastaClient cors error, remove default req headers
- 160f88e: Leverage aiSDK processDataStream util in MastraClient
- 3811029: Add identifying header
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

## 0.1.13-alpha.3

### Patch Changes

- 160f88e: Leverage aiSDK processDataStream util in MastraClient
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3

## 0.1.13-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2

## 0.1.13-alpha.1

### Patch Changes

- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1

## 0.1.13-alpha.0

### Patch Changes

- 0206617: Fix mastaClient cors error, remove default req headers
- 3811029: Add identifying header
- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.1.12

### Patch Changes

- 05ef3e0: Support voice for mastra client
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.1.12-alpha.1

### Patch Changes

- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.1.12-alpha.0

### Patch Changes

- 05ef3e0: Support voice for mastra client
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.1.11

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.1.11-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.1.11-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.1.10

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.1.9

### Patch Changes

- 0850b4c: Watch and resume per run
- 4356859: Bump types from core so it can pass instructions optionally
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

## 0.1.9-alpha.2

### Patch Changes

- 0850b4c: Watch and resume per run
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.1.9-alpha.1

### Patch Changes

- 4356859: Bump types from core so it can pass instructions optionally
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.1.8

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0

## 0.1.7

### Patch Changes

- 960690d: Improve client-js workflow watch dx
- 8deb34c: Better workflow watch api + watch workflow by runId
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

## 0.1.7-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.1.7-alpha.11

### Patch Changes

- 8deb34c: Better workflow watch api + watch workflow by runId
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.1.7-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.1.7-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9

## 0.1.7-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8

## 0.1.7-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7

## 0.1.7-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6

## 0.1.7-alpha.5

### Patch Changes

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

## 0.1.7-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.1.7-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3

## 0.1.7-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2

## 0.1.7-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1

## 0.1.7-alpha.0

### Patch Changes

- 960690d: Improve client-js workflow watch dx
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.6

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.5

### Patch Changes

- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- 7a64aff: Add more types to client-js sdk
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

## 0.1.5-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4

## 0.1.5-alpha.3

### Patch Changes

- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- 7a64aff: Add more types to client-js sdk
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.4-alpha.2

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.4-alpha.1

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.4-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.3

### Patch Changes

- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.2

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.2-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.2-alpha.0

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.0

### Patch Changes

- b9ef5fd: Add workflow watch and resume to client sdk

## 0.1.0-alpha.18

### Patch Changes

- b9ef5fd: Add workflow watch and resume to client sdk
