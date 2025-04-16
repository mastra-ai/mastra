# @mastra/core

## 0.9.0-alpha.3

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

## 0.8.4-alpha.2

### Patch Changes

- 9ee4293: Improve commonjs support

  Add types files in the root directory to make sure typescript can resolve it without an exportsmap

## 0.8.4-alpha.1

### Patch Changes

- 8a8a73b: fix container to network sub agent
- 6f92295: Fixed an issue where some user messages and llm messages would have the exact same createdAt date, leading to incorrect message ordering. Added a fix for new messages as well as any that were saved before the fix in the wrong order

## 0.8.4-alpha.0

### Patch Changes

- 03f3cd0: Propagate context to passed in tools

## 0.8.3

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 0bcc862: Fixed an issue where we were sanitizing response message content and filter on a value that may not always be an array
- 10a8caf: Removed an extra console log that made it into core
- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false
- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- 7f1b291: Client Side tool call passing

## 0.8.3-alpha.5

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables

## 0.8.3-alpha.4

### Patch Changes

- 7f1b291: Client Side tool call passing

## 0.8.3-alpha.3

### Patch Changes

- 10a8caf: Removed an extra console log that made it into core

## 0.8.3-alpha.2

### Patch Changes

- 0bcc862: Fixed an issue where we were sanitizing response message content and filter on a value that may not always be an array

## 0.8.3-alpha.1

### Patch Changes

- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages

## 0.8.3-alpha.0

### Patch Changes

- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false

## 0.8.2

### Patch Changes

- a06aadc: Upgrade fastembed to fix bug where fastembe cannot be imported

## 0.8.2-alpha.0

### Patch Changes

- a06aadc: Upgrade fastembed to fix bug where fastembe cannot be imported

## 0.8.1

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.8.1-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.8.0

### Minor Changes

- 619c39d: Added support for agents as steps

### Patch Changes

- 56c31b7: Batch insert messages for libsql adapter
- 5ae0180: Removed prefixed doc references
- fe56be0: exclude \_\_primitive, getMemory, hasOwnMemory from traces since they create noisy traces
- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg
- 107bcfe: Fixed JSON parsing in memory component to prevent crashes when encountering strings that start with '[' or '{' but are not valid JSON
- 9bfa12b: Accept ID on step config
- 515ebfb: Fix compound subscriber bug
- 5b4e19f: fix hanging and excessive workflow execution
- dbbbf80: Added clickhouse storage
- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- fca3b21: fix server in mastra not to be mandatory
- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- f37f535: Added variables to while and until loops
- a3f0e90: Update storage initialization to ensure tables are present
- 4d67826: Fix eval writes, remove id column
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- 99d43b9: Updated evaluate to include agent output
- d7e08e8: createdAt needs to be nullable
- febc8a6: Added dual tracing and fixed local tracing recursion
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- 0118361: Add resourceId to memory metadata
- 619c39d: AgentStep -> Agent as a workflow step (WIP)
- cafae83: Changed error messages for vector mismatch with index
- 8076ecf: Unify workflow watch/start response
- 8df4a77: Fix if-else execution order
- 304397c: Add support for custom api routes in mastra

## 0.8.0-alpha.8

### Patch Changes

- 8df4a77: Fix if-else execution order

## 0.8.0-alpha.7

### Patch Changes

- febc8a6: Added dual tracing and fixed local tracing recursion

## 0.8.0-alpha.6

### Patch Changes

- a3f0e90: Update storage initialization to ensure tables are present

## 0.8.0-alpha.5

### Patch Changes

- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg

## 0.8.0-alpha.4

### Patch Changes

- d7e08e8: createdAt needs to be nullable

## 0.8.0-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 9bfa12b: Accept ID on step config
- 515ebfb: Fix compound subscriber bug
- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- f37f535: Added variables to while and until loops
- 4d67826: Fix eval writes, remove id column
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance

## 0.8.0-alpha.2

### Patch Changes

- 56c31b7: Batch insert messages for libsql adapter
- dbbbf80: Added clickhouse storage
- 99d43b9: Updated evaluate to include agent output

## 0.8.0-alpha.1

### Minor Changes

- 619c39d: Added support for agents as steps

### Patch Changes

- fe56be0: exclude \_\_primitive, getMemory, hasOwnMemory from traces since they create noisy traces
- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- fca3b21: fix server in mastra not to be mandatory
- 0118361: Add resourceId to memory metadata
- 619c39d: AgentStep -> Agent as a workflow step (WIP)

## 0.7.1-alpha.0

### Patch Changes

- 107bcfe: Fixed JSON parsing in memory component to prevent crashes when encountering strings that start with '[' or '{' but are not valid JSON
- 5b4e19f: fix hanging and excessive workflow execution
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- cafae83: Changed error messages for vector mismatch with index
- 8076ecf: Unify workflow watch/start response
- 304397c: Add support for custom api routes in mastra

## 0.7.0

### Minor Changes

- 1af25d5: Added nested workflows API

### Patch Changes

- b4fbc59: Fixed an issue where sending CoreMessages to AI SDK would result in "Unsupported role: tool" errors
- a838fde: Update memory.ts
- a8bd4cf: Fixed JSON Schema generation for null types to prevent duplicate null entries in type arrays
- 7a3eeb0: Fixed a memory issue when using useChat where new messages were formatted as ui messages, were mixed with stored core messages in memory, and a mixed list was sent to AI SDK, causing it to error
- 0b54522: AgentNetwork logs
- b3b34f5: Fix agent generate,stream returnType with experimental_output
- a4686e8: Realtime event queue
- 6530ad1: Correct agent onFinish interface
- 27439ad: Updated the jsonSchemaPropertiesToTSTypes function to properly handle JSON Schema definitions where type can be an array of strings. Previously, the function only handled single string types, but according to the JSON Schema specification, type can be an array of possible types.

## 0.7.0-alpha.3

### Patch Changes

- b3b34f5: Fix agent generate,stream returnType with experimental_output
- a4686e8: Realtime event queue

## 0.7.0-alpha.2

### Patch Changes

- a838fde: Update memory.ts
- a8bd4cf: Fixed JSON Schema generation for null types to prevent duplicate null entries in type arrays
- 7a3eeb0: Fixed a memory issue when using useChat where new messages were formatted as ui messages, were mixed with stored core messages in memory, and a mixed list was sent to AI SDK, causing it to error
- 6530ad1: Correct agent onFinish interface

## 0.7.0-alpha.1

### Minor Changes

- 1af25d5: Added nested workflows API

### Patch Changes

- 0b54522: AgentNetwork logs
- 27439ad: Updated the jsonSchemaPropertiesToTSTypes function to properly handle JSON Schema definitions where type can be an array of strings. Previously, the function only handled single string types, but according to the JSON Schema specification, type can be an array of possible types.

## 0.6.5-alpha.0

### Patch Changes

- b4fbc59: Fixed an issue where sending CoreMessages to AI SDK would result in "Unsupported role: tool" errors

## 0.6.4

### Patch Changes

- 6794797: Check for eval values before inserting into storage
- fb68a80: Inject mastra instance into llm class
- b56a681: Update README and some tests for vector stores
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.6.4-alpha.1

### Patch Changes

- 6794797: Check for eval values before inserting into storage

## 0.6.4-alpha.0

### Patch Changes

- fb68a80: Inject mastra instance into llm class
- b56a681: Update README and some tests for vector stores
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.6.3

### Patch Changes

- 404640e: AgentNetwork changeset
- 3bce733: fix: agent.generate only get thread if there is threadID

## 0.6.3-alpha.1

### Patch Changes

- 3bce733: fix: agent.generate only get thread if there is threadID

## 0.6.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset

## 0.6.2

### Patch Changes

- beaf1c2: createTool type fixes
- 3084e13: More parallel memory operations

## 0.6.2-alpha.0

### Patch Changes

- beaf1c2: createTool type fixes
- 3084e13: More parallel memory operations

## 0.6.1

### Patch Changes

- fc2f89c: Insert static payload into inputData
- dfbb131: Fix after method on multiple passes
- f4854ee: Fix else branch execution when if-branch has loops
- afaf73f: Add fix for vercel tools and optional instructions
- 0850b4c: Watch and resume per run
- 7bcfaee: Remove node_modules-path dir which calls \_\_dirname at the top level and breaks some esm runtimes
- 44631b1: Fix after usage with skipped conditions on the awaited steps
- 9116d70: Handle the different workflow methods in workflow graph
- 6e559a0: Update Voice for realtime providers
- 5f43505: feat: OpenAI realtime voice provider for speech to speech communication
  Update voice speaking event type

## 0.6.1-alpha.2

### Patch Changes

- fc2f89c: Insert static payload into inputData
- dfbb131: Fix after method on multiple passes
- 0850b4c: Watch and resume per run
- 9116d70: Handle the different workflow methods in workflow graph

## 0.6.1-alpha.1

### Patch Changes

- f4854ee: Fix else branch execution when if-branch has loops
- afaf73f: Add fix for vercel tools and optional instructions
- 44631b1: Fix after usage with skipped conditions on the awaited steps
- 6e559a0: Update Voice for realtime providers
- 5f43505: feat: OpenAI realtime voice provider for speech to speech communication
  Update voice speaking event type

## 0.6.1-alpha.0

### Patch Changes

- 7bcfaee: Remove node_modules-path dir which calls \_\_dirname at the top level and breaks some esm runtimes

## 0.6.0

### Minor Changes

- 1c8cda4: Experimental .afterEvent() support. Fixed suspend/resume in first workflow or .after() branch step. Changed suspend metadata to be in context.resumeData instead of resumed step output.
- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- 16b98d9: Reduce default step retry attempts
- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()
- c2144f4: Enable dynamic import of default-storage to reduce runtime/bundle size when not using default storage

## 0.6.0-alpha.1

### Minor Changes

- 1c8cda4: Experimental .afterEvent() support. Fixed suspend/resume in first workflow or .after() branch step. Changed suspend metadata to be in context.resumeData instead of resumed step output.
- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- 16b98d9: Reduce default step retry attempts
- c2144f4: Enable dynamic import of default-storage to reduce runtime/bundle size when not using default storage

## 0.5.1-alpha.0

### Patch Changes

- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()

## 0.5.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.
- dfbe4e9: Added new looping constructs with while/until and optional enum-based cyclical condition execution
- 3764e71: Workflow trigger data should only accept object types
- 02ffb7b: Added updateIndexById and deleteIndexById methods in the MastraVector inteface
- 358f069: Experimental if-else branching in between steps

### Patch Changes

- a910463: Improve typinges for getStepResult and workflow results
- 22643eb: Replace MastraPrimitives with direct Mastra instance
- 6feb23f: Fix for else condition with ref/query syntax
- f2d6727: Support for compound `.after` syntax
- 7a7a547: Fix telemetry getter in hono server
- 29f3a82: Improve agent generate,stream returnTypes
- 3d0e290: Fixed an issue where messages that were numbers weren't being stored as strings. Fixed incorrect array access when retrieving memory messages
- e9fbac5: Update Vercel tools to have id and update deployer
- 301e4ee: Fix log level showing number in core logger
- ee667a2: Fixed a serialization bug for thread IDs and dates in memory
- dab255b: Fixed bug where using an in memory libsql db (config.url = ":memory:) for memory would throw errors about missing tables
- 1e8bcbc: Fix suspend types
- f6678e4: Fixed an issue where we were using a non-windows-friendly absolute path check for libsql file urls
- 9e81f35: Fix query filter for vector search and rerank
- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- a85ab24: make execute optional for create tool
- dbd9f2d: Handle different condition types on workflow graph
- 59df7b6: Keep default memory db in .mastra/mastra.db, not .mastra/output/memory.db for consistency
- caefaa2: Added optional chaining to a memory function call that may not exist
- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- 52e0418: Split up action types between tools and workflows
- d79aedf: Fix import/require paths in these package.json
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- df982db: Updated Agent tool input to accept vercel tool format
- a171b37: Better retry mechanisms
- 506f1d5: Properly serialize any date object when inserting into libsql
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- 2259379: Add documentation for workflow looping APIs
- aeb5e36: Adds default schema for tool when not provided
- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.
- fd4a1d7: Update cjs bundling to make sure files are split
- c139344: When converting JSON schemas to Zod schemas, we were sometimes marking optional fields as nullable instead, making them required with a null value, even if the schema didn't mark them as required

## 0.5.0-alpha.12

### Patch Changes

- a85ab24: make execute optional for create tool

## 0.5.0-alpha.11

### Patch Changes

- 7a7a547: Fix telemetry getter in hono server
- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- dbd9f2d: Handle different condition types on workflow graph
- a171b37: Better retry mechanisms
- fd4a1d7: Update cjs bundling to make sure files are split

## 0.5.0-alpha.10

### Patch Changes

- a910463: Improve typinges for getStepResult and workflow results

## 0.5.0-alpha.9

### Patch Changes

- e9fbac5: Update Vercel tools to have id and update deployer
- 1e8bcbc: Fix suspend types
- aeb5e36: Adds default schema for tool when not provided
- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.

## 0.5.0-alpha.8

### Patch Changes

- 506f1d5: Properly serialize any date object when inserting into libsql

## 0.5.0-alpha.7

### Patch Changes

- ee667a2: Fixed a serialization bug for thread IDs and dates in memory

## 0.5.0-alpha.6

### Patch Changes

- f6678e4: Fixed an issue where we were using a non-windows-friendly absolute path check for libsql file urls

## 0.5.0-alpha.5

### Minor Changes

- dfbe4e9: Added new looping constructs with while/until and optional enum-based cyclical condition execution
- 3764e71: Workflow trigger data should only accept object types
- 358f069: Experimental if-else branching in between steps

### Patch Changes

- 22643eb: Replace MastraPrimitives with direct Mastra instance
- 6feb23f: Fix for else condition with ref/query syntax
- f2d6727: Support for compound `.after` syntax
- 301e4ee: Fix log level showing number in core logger
- 9e81f35: Fix query filter for vector search and rerank
- caefaa2: Added optional chaining to a memory function call that may not exist
- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- 52e0418: Split up action types between tools and workflows
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- df982db: Updated Agent tool input to accept vercel tool format
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- 2259379: Add documentation for workflow looping APIs

## 0.5.0-alpha.4

### Patch Changes

- d79aedf: Fix import/require paths in these package.json

## 0.5.0-alpha.3

### Patch Changes

- 3d0e290: Fixed an issue where messages that were numbers weren't being stored as strings. Fixed incorrect array access when retrieving memory messages

## 0.5.0-alpha.2

### Minor Changes

- 02ffb7b: Added updateIndexById and deleteIndexById methods in the MastraVector inteface

## 0.5.0-alpha.1

### Patch Changes

- dab255b: Fixed bug where using an in memory libsql db (config.url = ":memory:) for memory would throw errors about missing tables

## 0.5.0-alpha.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.

### Patch Changes

- 29f3a82: Improve agent generate,stream returnTypes
- 59df7b6: Keep default memory db in .mastra/mastra.db, not .mastra/output/memory.db for consistency
- c139344: When converting JSON schemas to Zod schemas, we were sometimes marking optional fields as nullable instead, making them required with a null value, even if the schema didn't mark them as required

## 0.4.4

### Patch Changes

- 1da20e7: Update typechecks for positional args

## 0.4.4-alpha.0

### Patch Changes

- 1da20e7: Update typechecks for positional args

## 0.4.3

### Patch Changes

- 0d185b1: Ensure proper message sort order for tool calls and results when using Memory semanticRecall feature
- ed55f1d: Fixes to watch payload in workloads with nested branching
- 06aa827: add option for specifying telemetry settings at generation time
- 0fd78ac: Update vector store functions to use object params
- 2512a93: Support all aisdk options for agent stream,generate
- e62de74: Fix optional tool llm
  execute
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- fd14a3f: Updating filter location from @mastra/core/filter to @mastra/core/vector/filter
- 8d13b14: Fixes early exits in workflows with branching
- 3f369a2: A better async/await based interface for suspend/resume tracking
- 3ee4831: Fixed agent.generate() so it properly infers the return type based on output: schema | string and experimental_output: schema
- 4d4e1e1: Updated vector tests and pinecone
- bb4f447: Add support for commonjs
- 108793c: Throw error when resourceId is not provided but Memory is configured and a threadId was passed
- 5f28f44: Updated Chroma Vector to allow for document storage
- dabecf4: Pass threadId and resourceId into tool execute functions so that tools are able to query memory

## 0.4.3-alpha.4

### Patch Changes

- dabecf4: Pass threadId and resourceId into tool execute functions so that tools are able to query memory

## 0.4.3-alpha.3

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- fd14a3f: Updating filter location from @mastra/core/filter to @mastra/core/vector/filter
- 3f369a2: A better async/await based interface for suspend/resume tracking
- 4d4e1e1: Updated vector tests and pinecone
- bb4f447: Add support for commonjs

## 0.4.3-alpha.2

### Patch Changes

- 2512a93: Support all aisdk options for agent stream,generate
- e62de74: Fix optional tool llm
  execute

## 0.4.3-alpha.1

### Patch Changes

- 0d185b1: Ensure proper message sort order for tool calls and results when using Memory semanticRecall feature
- ed55f1d: Fixes to watch payload in workloads with nested branching
- 8d13b14: Fixes early exits in workflows with branching
- 3ee4831: Fixed agent.generate() so it properly infers the return type based on output: schema | string and experimental_output: schema
- 108793c: Throw error when resourceId is not provided but Memory is configured and a threadId was passed
- 5f28f44: Updated Chroma Vector to allow for document storage

## 0.4.3-alpha.0

### Patch Changes

- 06aa827: add option for specifying telemetry settings at generation time

## 0.4.2

### Patch Changes

- 7fceae1: Removed system prompt with todays date since it can interfere with input token caching. Also removed a memory system prompt that refered to date ranges - we no longer use date ranges for memory so this was removed
- 8d94c3e: Optional tool execute
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 6cb63e0: Experimental output support
- f626fbb: add stt and tts capabilities on agent
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- eb91535: Correct typo in LanguageModel-related

## 0.4.2-alpha.2

### Patch Changes

- 8d94c3e: Optional tool execute
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- eb91535: Correct typo in LanguageModel-related

## 0.4.2-alpha.1

### Patch Changes

- 6cb63e0: Experimental output support

## 0.4.2-alpha.0

### Patch Changes

- 7fceae1: Removed system prompt with todays date since it can interfere with input token caching. Also removed a memory system prompt that refered to date ranges - we no longer use date ranges for memory so this was removed
- f626fbb: add stt and tts capabilities on agent

## 0.4.1

### Patch Changes

- ce44b9b: Fixed a bug where embeddings were being created for memory even when semanticRecall was turned off
- 967da43: Logger, transport fixes
- b405f08: add stt and tts capabilities on agent

## 0.4.0

### Minor Changes

- 2fc618f: Add MastraVoice class

### Patch Changes

- fe0fd01: Fixed a bug where masked tags don't work when a chunk includes other text (ex "o <start_tag" or "tag> w") in the maskStreamTags() util

## 0.4.0-alpha.1

### Patch Changes

- fe0fd01: Fixed a bug where masked tags don't work when a chunk includes other text (ex "o <start_tag" or "tag> w") in the maskStreamTags() util

## 0.4.0-alpha.0

### Minor Changes

- 2fc618f: Add MastraVoice class

## 0.3.0

### Minor Changes

- f205ede: Memory can no longer be added to new Mastra(), only to new Agent() - this is for simplicity as each agent will typically need its own memory settings

## 0.2.1

### Patch Changes

- d59f1a8: Added example docs for evals and export metricJudge
- 91ef439: Add eslint and ran autofix
- 4a25be4: Fixed race condition when multiple storage methods attempt to initialize the db at the same time
- bf2e88f: Fix treeshake bug
- 2f0d707: Fix wrong usage of peerdep of AI pkg
- aac1667: Improve treeshaking of core and output

## 0.2.1-alpha.0

### Patch Changes

- d59f1a8: Added example docs for evals and export metricJudge
- 91ef439: Add eslint and ran autofix
- 4a25be4: Fixed race condition when multiple storage methods attempt to initialize the db at the same time
- bf2e88f: Fix treeshake bug
- 2f0d707: Fix wrong usage of peerdep of AI pkg
- aac1667: Improve treeshaking of core and output

## 0.2.0

### Minor Changes

- 4d4f6b6: Update deployer
- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes
- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)
- 5285356: Renamed MastraLibSQLStorage and MastraLibSQLVector to DefaultStorage and DefaultVectorDB. I left the old export names so that it wont break anyones projects but all docs now show the new names
- 74b3078: Reduce verbosity in workflows API
- 8b416d9: Breaking changes
- 16e5b04: Moved @mastra/vector-libsql into @mastra/core/vector/libsql
- 8769a62: Split core into seperate entry fils

### Patch Changes

- f537e33: feat: add default logger
- 6f2c0f5: Prevent telemetry proxy from converting sync methods to async
- e4d4ede: Better setLogger()
- 0be7181: Fix forward version
- dd6d87f: Update Agent and LLM config to accept temperature setting
- 9029796: add more logs to agent for debugging
- 6fa4bd2: New LLM primitive, OpenAI, AmazonBedrock
- f031a1f: expose embed from rag, and refactor embed
- 8151f44: Added \_\_registerPrimitives to model.ts
- d7d465a: Embedding api
- 73d112c: Core and deployer fixes
- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 9d1796d: Fix storage and eval serialization on api
- e897f1c: Eval change
- 4a54c82: Fix dane labelling functionality
- 3967e69: Added GraphRAG implementation and updated docs
- 8ae2bbc: Dane publishing
- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding
- 016493a: Deprecate metrics in favor of evals
- bc40916: Pass mastra instance directly into actions allowing access to all registered primitives
- 93a3719: Mastra prompt template engine
- 7d83b92: Create default storage and move evals towards it
- 9fb3039: Storage
- d5e12de: optional mastra config object
- e1dd94a: update the api for embeddings
- 07c069d: Add dotenv as dependency
- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 685108a: Remove syncs and excess rag
- c8ff2f5: Fixed passing CoreMessages to stream/generate where the role is not user. Previously all messages would be rewritten to have role: "user"
- 5fdc87c: Update evals storage in attachListeners
- ae7bf94: Fix loggers messing up deploys
- 8e7814f: Add payload getter on machine context
- 66a03ec: Removed an extra llm call that was needed for the old Memory API but is no longer needed
- 7d87a15: generate command in agent, and support array of message strings
- b97ca96: Tracing into default storage
- 23dcb23: Redeploy core
- 033eda6: More fixes for refactor
- 8105fae: Split embed into embed and embedMany to handle different return types
- e097800: TTS in core
- 1944807: Unified logger and major step in better logs
- 1874f40: Added re ranking tool to RAG
- 685108a: Removing mastra syncs
- f7d1131: Improved types when missing inputSchema
- 79acad0: Better type safety on trigger step
- 7a19083: Updates to the LLM class
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 1ebd071: Add more embedding models
- 0b74006: Workflow updates
- 2f17a5f: Added filter translator and tests for Qdrant
- f368477: Added evals package and added evals in core
- 7892533: Updated test evals to use Mastra Storage
- 9c10484: update all packages
- b726bf5: Fix agent memory int.
- 70dabd9: Fix broken publish
- 21fe536: add keyword tags for packages and update readmes
- 176bc42: Added runId and proper parent spans to workflow tracing
- 401a4d9: Add simple conditions test
- 2e099d2: Allow trigger passed in to `then` step
- 0b826f6: Allow agents to use ZodSchemas in structuredOutput
- d68b532: Updated debug logs
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- e6d8055: Added Mastra Storage to add and query live evals
- e2e76de: Anthropic model added to new primitive structure
- ccbc581: Updated operator validation and handling for all vector stores
- 5950de5: Added update instructions API
- fe3dcb0: Add fastembed import error handling
- 78eec7c: Started implementation on Unified Filter API for several vector stores.
- a8a459a: Updated Evals table UI
- 0be7181: Add perplexity models
- 7b87567: Propagate setLogger calls to more places
- b524c22: Package upgrades
- df843d3: Fixed libsql db relative file paths so they're always outside the .mastra directory. If they're inside .mastra they will be deleted when code is re-bundled
- 4534e77: Fix fastembed imports in mastra cloud for default embedder
- d6d8159: Workflow graph diagram
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- f6ba259: simplify generate api
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- eedb829: Better types, and correct payload resolution
- cb290ee: Reworked the Memory public API to have more intuitive and simple property names
- b4d7416: Added the ability to pass a configured Memory class instance directly to new Agent instances instead of passing memory to Mastra
- e608d8c: Export CoreMessage Types from ai sdk
- 06b2c0a: Update summarization prompt and fix eval input
- 002d6d8: add memory to playground agent
- e448a26: Correctly pass down runId to called tools
- fd494a3: TTS module
- dc90663: Fix issues in packages
- c872875: update createMultiLogger to combineLogger
- 3c4488b: Fix context not passed in agent tool execution
- a7b016d: Added export for MockMastraEngine from @mastra/core
- fd75f3c: Added storage, vector, embedder setters to the base MastraMemory class
- 7f24c29: Add Chroma Filter translator and updated vector store tests
- 2017553: Added fallback title when calling createThread() with no title - this is needed as storage db schemas mark title as non-null
- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 963c15a: Add new toolset primitive and implementation for composio
- 7365b6c: More models
- 5ee67d3: make trace name configurable for telemetry exporter
- d38f7a6: clean up old methods in agent
- 38b7f66: Update deployer logic
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- 1420ae2: Fix storage logger
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- 3700be1: Added helpful error when using vector with Memory class - error now contains embedding option example
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config
- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed
- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- 04434b6: Create separate logger file
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.
- 9f3ab05: pass custom telemetry exporter
- 66a5392: batchInsert needs init. Use private version for internal calls
- 4b1ce2c: Update Google model support in documentation and type definitions to include new Gemini versions
- 14064f2: Deployer abstract class
- f5dfa20: only add logger if there is a logger
- 327ece7: Updates for ts versions
- da2e8d3: Export EmbedManyResult and EmbedResult from ai sdk and update docs
- 95a4697: Fixed trace method for telemetry
- d5fccfb: expose model function
- 3427b95: Updated docs to include intermediate rag examples (metadata filtering, query filters, etc)
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- e66643a: Add o1 models
- b5393f1: New example: Dane and many fixes to make it work
- d2cd535: configure dotenv in core
- c2dd6b5: This set of changes introduces a new .step API for subscribing to step executions for running other step chains. It also improves step types, and enables the ability to create a cyclic step chain.
- 67637ba: Fixed storage bugs related to the new Memory API
- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core
- 5ee2e78: Update core for Alpha3 release
- cd02c56: Implement a new and improved API for workflows.
- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory
- d9c8dd0: Logger changes for default transports
- 9fb59d6: changeset
- a9345f9: Fixed tsc build for core types
- 99f1847: Clean up logs
- 04f3171: More providers
- d5ec619: Remove promptTemplate from core
- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses
- ae7bf94: Changeset
- 4f1d1a1: Enforce types ann cleanup package.json
- ee4de15: Dane fixes
- 202d404: Added instructions when generating evals
- a221426: Simplify workflows watch API

## 0.2.0-alpha.110

### Patch Changes

- 016493a: Deprecate metrics in favor of evals
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 176bc42: Added runId and proper parent spans to workflow tracing
- d68b532: Updated debug logs
- fe3dcb0: Add fastembed import error handling
- e448a26: Correctly pass down runId to called tools
- fd75f3c: Added storage, vector, embedder setters to the base MastraMemory class
- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- a221426: Simplify workflows watch API

## 0.2.0-alpha.109

### Patch Changes

- d5fccfb: expose model function

## 0.2.0-alpha.108

### Patch Changes

- 5ee67d3: make trace name configurable for telemetry exporter
- 95a4697: Fixed trace method for telemetry

## 0.2.0-alpha.107

### Patch Changes

- 66a5392: batchInsert needs init. Use private version for internal calls

## 0.2.0-alpha.106

### Patch Changes

- 6f2c0f5: Prevent telemetry proxy from converting sync methods to async
- a8a459a: Updated Evals table UI

## 0.2.0-alpha.105

### Patch Changes

- 1420ae2: Fix storage logger
- 99f1847: Clean up logs

## 0.2.0-alpha.104

### Patch Changes

- 5fdc87c: Update evals storage in attachListeners
- b97ca96: Tracing into default storage
- 72d1990: Updated evals table schema
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config

## 0.2.0-alpha.103

### Patch Changes

- 4534e77: Fix fastembed imports in mastra cloud for default embedder

## 0.2.0-alpha.102

### Patch Changes

- a9345f9: Fixed tsc build for core types

## 0.2.0-alpha.101

### Patch Changes

- 66a03ec: Removed an extra llm call that was needed for the old Memory API but is no longer needed
- 4f1d1a1: Enforce types ann cleanup package.json

## 0.2.0-alpha.100

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api

## 0.2.0-alpha.99

### Patch Changes

- 7d83b92: Create default storage and move evals towards it

## 0.2.0-alpha.98

### Patch Changes

- 70dabd9: Fix broken publish
- 202d404: Added instructions when generating evals

## 0.2.0-alpha.97

### Patch Changes

- 07c069d: Add dotenv as dependency
- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- 5950de5: Added update instructions API
- df843d3: Fixed libsql db relative file paths so they're always outside the .mastra directory. If they're inside .mastra they will be deleted when code is re-bundled
- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed

## 0.2.0-alpha.96

### Minor Changes

- 74b3078: Reduce verbosity in workflows API

## 0.2.0-alpha.95

### Patch Changes

- 9fb59d6: changeset

## 0.2.0-alpha.94

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages

## 0.2.0-alpha.93

### Minor Changes

- 5285356: Renamed MastraLibSQLStorage and MastraLibSQLVector to DefaultStorage and DefaultVectorDB. I left the old export names so that it wont break anyones projects but all docs now show the new names

## 0.2.0-alpha.92

### Minor Changes

- 4d4f6b6: Update deployer

## 0.2.0-alpha.91

### Minor Changes

- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)
- 16e5b04: Moved @mastra/vector-libsql into @mastra/core/vector/libsql

### Patch Changes

- d7d465a: Embedding api
- 2017553: Added fallback title when calling createThread() with no title - this is needed as storage db schemas mark title as non-null
- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs

## 0.2.0-alpha.90

### Patch Changes

- 8151f44: Added \_\_registerPrimitives to model.ts
- e897f1c: Eval change
- 3700be1: Added helpful error when using vector with Memory class - error now contains embedding option example

## 0.2.0-alpha.89

### Patch Changes

- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses

## 0.2.0-alpha.88

### Patch Changes

- ccbc581: Updated operator validation and handling for all vector stores

## 0.2.0-alpha.87

### Patch Changes

- 7365b6c: More models

## 0.2.0-alpha.86

### Patch Changes

- 6fa4bd2: New LLM primitive, OpenAI, AmazonBedrock
- e2e76de: Anthropic model added to new primitive structure
- 7f24c29: Add Chroma Filter translator and updated vector store tests
- 67637ba: Fixed storage bugs related to the new Memory API
- 04f3171: More providers

## 0.2.0-alpha.85

### Patch Changes

- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding

## 0.2.0-alpha.84

### Patch Changes

- 2f17a5f: Added filter translator and tests for Qdrant
- cb290ee: Reworked the Memory public API to have more intuitive and simple property names
- b4d7416: Added the ability to pass a configured Memory class instance directly to new Agent instances instead of passing memory to Mastra
- 38b7f66: Update deployer logic

## 0.2.0-alpha.83

### Minor Changes

- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes
- 8769a62: Split core into seperate entry fils

### Patch Changes

- 78eec7c: Started implementation on Unified Filter API for several vector stores.
- 9625602: Use mastra core splitted bundles in other packages

## 0.1.27-alpha.82

### Patch Changes

- 73d112c: Core and deployer fixes

## 0.1.27-alpha.81

### Patch Changes

- 9fb3039: Storage

## 0.1.27-alpha.80

### Patch Changes

- 327ece7: Updates for ts versions

## 0.1.27-alpha.79

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes

## 0.1.27-alpha.78

### Patch Changes

- 685108a: Remove syncs and excess rag
- 685108a: Removing mastra syncs

## 0.1.27-alpha.77

### Patch Changes

- 8105fae: Split embed into embed and embedMany to handle different return types

## 0.1.27-alpha.76

### Patch Changes

- ae7bf94: Fix loggers messing up deploys
- ae7bf94: Changeset

## 0.1.27-alpha.75

### Patch Changes

- 23dcb23: Redeploy core

## 0.1.27-alpha.74

### Patch Changes

- 7b87567: Propagate setLogger calls to more places

## 0.1.27-alpha.73

### Patch Changes

- 3427b95: Updated docs to include intermediate rag examples (metadata filtering, query filters, etc)

## 0.1.27-alpha.72

### Patch Changes

- e4d4ede: Better setLogger()
- 06b2c0a: Update summarization prompt and fix eval input

## 0.1.27-alpha.71

### Patch Changes

- d9c8dd0: Logger changes for default transports

## 0.1.27-alpha.70

### Patch Changes

- dd6d87f: Update Agent and LLM config to accept temperature setting
- 04434b6: Create separate logger file

## 0.1.27-alpha.69

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs

## 0.1.27-alpha.68

### Patch Changes

- 0be7181: Fix forward version
- 0be7181: Add perplexity models

## 0.1.27-alpha.67

### Patch Changes

- c8ff2f5: Fixed passing CoreMessages to stream/generate where the role is not user. Previously all messages would be rewritten to have role: "user"

## 0.1.27-alpha.66

### Patch Changes

- 14064f2: Deployer abstract class

## 0.1.27-alpha.65

### Patch Changes

- e66643a: Add o1 models

## 0.1.27-alpha.64

### Patch Changes

- f368477: Added evals package and added evals in core
- d5ec619: Remove promptTemplate from core

## 0.1.27-alpha.63

### Patch Changes

- e097800: TTS in core

## 0.1.27-alpha.62

### Patch Changes

- 93a3719: Mastra prompt template engine

## 0.1.27-alpha.61

### Patch Changes

- dc90663: Fix issues in packages

## 0.1.27-alpha.60

### Patch Changes

- 3967e69: Added GraphRAG implementation and updated docs

## 0.1.27-alpha.59

### Patch Changes

- b524c22: Package upgrades

## 0.1.27-alpha.58

### Patch Changes

- 1874f40: Added re ranking tool to RAG
- 4b1ce2c: Update Google model support in documentation and type definitions to include new Gemini versions

## 0.1.27-alpha.57

### Patch Changes

- fd494a3: TTS module

## 0.1.27-alpha.56

### Patch Changes

- 9f3ab05: pass custom telemetry exporter

## 0.1.27-alpha.55

### Patch Changes

- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates

## 0.1.27-alpha.54

### Patch Changes

- d2cd535: configure dotenv in core

## 0.1.27-alpha.53

### Patch Changes

- 8e7814f: Add payload getter on machine context

## 0.1.27-alpha.52

### Patch Changes

- eedb829: Better types, and correct payload resolution

## 0.1.27-alpha.51

### Patch Changes

- a7b016d: Added export for MockMastraEngine from @mastra/core
- da2e8d3: Export EmbedManyResult and EmbedResult from ai sdk and update docs
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs

## 0.1.27-alpha.50

### Patch Changes

- 401a4d9: Add simple conditions test

## 0.1.27-alpha.49

### Patch Changes

- 79acad0: Better type safety on trigger step
- f5dfa20: only add logger if there is a logger

## 0.1.27-alpha.48

### Patch Changes

- b726bf5: Fix agent memory int.

## 0.1.27-alpha.47

### Patch Changes

- f6ba259: simplify generate api

## 0.1.27-alpha.46

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes

## 0.1.27-alpha.45

### Patch Changes

- e608d8c: Export CoreMessage Types from ai sdk
- 002d6d8: add memory to playground agent

## 0.1.27-alpha.44

### Patch Changes

- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges

## 0.1.27-alpha.43

### Patch Changes

- 2e099d2: Allow trigger passed in to `then` step
- d6d8159: Workflow graph diagram

## 0.1.27-alpha.42

### Patch Changes

- 4a54c82: Fix dane labelling functionality

## 0.1.27-alpha.41

### Patch Changes

- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs

## 0.1.27-alpha.40

### Patch Changes

- 9029796: add more logs to agent for debugging

## 0.1.27-alpha.39

### Patch Changes

- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page

## 0.1.27-alpha.38

### Patch Changes

- f031a1f: expose embed from rag, and refactor embed

## 0.1.27-alpha.37

### Patch Changes

- c872875: update createMultiLogger to combineLogger
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- b5393f1: New example: Dane and many fixes to make it work

## 0.1.27-alpha.36

### Patch Changes

- f537e33: feat: add default logger
- bc40916: Pass mastra instance directly into actions allowing access to all registered primitives
- f7d1131: Improved types when missing inputSchema
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- 3c4488b: Fix context not passed in agent tool execution
- d38f7a6: clean up old methods in agent

## 0.1.27-alpha.35

### Patch Changes

- 033eda6: More fixes for refactor

## 0.1.27-alpha.34

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.

## 0.1.27-alpha.33

### Patch Changes

- e1dd94a: update the api for embeddings

## 0.1.27-alpha.32

### Patch Changes

- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli

## 0.1.27-alpha.31

### Patch Changes

- c2dd6b5: This set of changes introduces a new .step API for subscribing to step executions for running other step chains. It also improves step types, and enables the ability to create a cyclic step chain.

## 0.1.27-alpha.30

### Patch Changes

- 963c15a: Add new toolset primitive and implementation for composio

## 0.1.27-alpha.29

### Patch Changes

- 7d87a15: generate command in agent, and support array of message strings

## 0.1.27-alpha.28

### Patch Changes

- 1ebd071: Add more embedding models

## 0.1.27-alpha.27

### Patch Changes

- cd02c56: Implement a new and improved API for workflows.

## 0.1.27-alpha.26

### Patch Changes

- d5e12de: optional mastra config object

## 0.1.27-alpha.25

### Patch Changes

- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory

## 0.1.27-alpha.24

### Patch Changes

- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core

## 0.1.27-alpha.23

### Patch Changes

- 0b826f6: Allow agents to use ZodSchemas in structuredOutput

## 0.1.27-alpha.22

### Patch Changes

- 7a19083: Updates to the LLM class

## 0.1.27-alpha.21

### Patch Changes

- 5ee2e78: Update core for Alpha3 release
