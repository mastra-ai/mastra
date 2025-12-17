# @mastra/react-hooks

## 0.1.0-beta.13

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.13

## 0.1.0-beta.12

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Updated dependencies [[`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce)]:
  - @mastra/client-js@1.0.0-beta.12

## 0.1.0-beta.11

### Patch Changes

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript showLineNumbers copy
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Updated dependencies [[`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/client-js@1.0.0-beta.11

## 0.1.0-beta.10

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Updated dependencies [[`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d)]:
  - @mastra/client-js@1.0.0-beta.10

## 0.1.0-beta.9

### Patch Changes

- Updated dependencies [[`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4)]:
  - @mastra/client-js@1.0.0-beta.9

## 0.1.0-beta.8

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.8

## 0.1.0-beta.7

### Patch Changes

- Updated dependencies [[`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141)]:
  - @mastra/client-js@1.0.0-beta.7

## 0.1.0-beta.6

### Patch Changes

- Adjust the types to accept tracingOptions ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

- Updated dependencies [[`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d)]:
  - @mastra/client-js@1.0.0-beta.6

## 0.1.0-beta.5

### Patch Changes

- Configurable resourceId in react useChat ([#10461](https://github.com/mastra-ai/mastra/pull/10461))

- fix(agent): persist messages before tool suspension ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Updated dependencies [[`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f)]:
  - @mastra/client-js@1.0.0-beta.5

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [[`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440)]:
  - @mastra/client-js@1.0.0-beta.4

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [[`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365)]:
  - @mastra/client-js@1.0.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@1.0.0-beta.2

## 0.1.0-beta.1

### Patch Changes

- Updated dependencies [[`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f)]:
  - @mastra/client-js@1.0.0-beta.1

## 0.1.0-beta.0

### Minor Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

### Patch Changes

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix multi modal in react sdk ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Updated dependencies [[`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014)]:
  - @mastra/client-js@1.0.0-beta.0

## 0.0.10

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4

## 0.0.10-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4-alpha.0

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3

## 0.0.9-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3-alpha.0

## 0.0.8

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2

## 0.0.8-alpha.1

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.1

## 0.0.8-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.0

## 0.0.7

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1

## 0.0.7-alpha.0

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1-alpha.0

## 0.0.6

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0

## 0.0.6-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.4

## 0.0.6-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.3

## 0.0.6-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.2

## 0.0.6-alpha.1

### Patch Changes

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.1

## 0.0.6-alpha.0

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0-alpha.0

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2

## 0.0.5-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.0

## 0.0.4

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1

## 0.0.4-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.4

## 0.0.4-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.3

## 0.0.4-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.2

## 0.0.4-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1-alpha.1

## 0.0.4-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.0

## 0.0.3

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0

## 0.0.3-alpha.0

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.0

## 0.0.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0

## 0.0.1-alpha.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0-alpha.1

## 0.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67)]:
  - @mastra/client-js@0.14.0-alpha.0
