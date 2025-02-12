# @mastra/core

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
