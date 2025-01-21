# @mastra/core

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
