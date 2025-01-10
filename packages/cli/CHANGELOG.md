# mastra

## 0.1.57-alpha.81

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates
- Updated dependencies [592e3cf]
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - @mastra/core@0.1.27-alpha.55

## 0.1.57-alpha.80

### Patch Changes

- Updated dependencies [d2cd535]
  - @mastra/core@0.1.27-alpha.54

## 0.1.57-alpha.79

### Patch Changes

- Updated dependencies [8e7814f]
  - @mastra/core@0.1.27-alpha.53

## 0.1.57-alpha.78

### Patch Changes

- f79a9ff: Fix example tool execution not workin in dev, add example tool to example agent, add example workflow to main Mastra export
- Updated dependencies [eedb829]
  - @mastra/core@0.1.27-alpha.52

## 0.1.57-alpha.77

### Patch Changes

- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- Updated dependencies [a7b016d]
- Updated dependencies [da2e8d3]
- Updated dependencies [538a136]
  - @mastra/core@0.1.27-alpha.51

## 0.1.57-alpha.76

### Patch Changes

- b6f9860: watch for changes in user mastra directory and restart server in cli dev
- cefd906: cli interactive api key configuration
- Updated dependencies [401a4d9]
  - @mastra/core@0.1.27-alpha.50

## 0.1.57-alpha.75

### Patch Changes

- Updated dependencies [79acad0]
- Updated dependencies [f5dfa20]
  - @mastra/core@0.1.27-alpha.49

## 0.1.57-alpha.74

### Patch Changes

- edd70b5: changeset

## 0.1.57-alpha.73

### Patch Changes

- aacfff6: publish new mastra, create-mastra

## 0.1.57-alpha.72

### Patch Changes

- 2667e66: fix create mastra publishing

## 0.1.57-alpha.71

### Patch Changes

- 1d68b0c: update dane publishing

## 0.1.57-alpha.70

### Patch Changes

- abdd42d: polish mastra create, fix create-mastra publishing

## 0.1.57-alpha.69

### Patch Changes

- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps

## 0.1.57-alpha.68

### Patch Changes

- c156b63: Add missing mastra deploy server deps

## 0.1.57-alpha.67

### Patch Changes

- Updated dependencies [b726bf5]
  - @mastra/core@0.1.27-alpha.48

## 0.1.57-alpha.66

### Patch Changes

- f2c5dfa: update endpoint path

## 0.1.57-alpha.65

### Patch Changes

- f6ba259: simplify generate api
- Updated dependencies [f6ba259]
  - @mastra/core@0.1.27-alpha.47

## 0.1.57-alpha.64

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes
- Updated dependencies [8ae2bbc]
- Updated dependencies [0bd142c]
- Updated dependencies [ee4de15]
  - @mastra/core@0.1.27-alpha.46

## 0.1.57-alpha.63

### Patch Changes

- 0091799: Add dev and deploy mastra commands to CLI references in documentation, update build successful message in dev command
- 1dbbb49: update netlify and cloudflare server templates

## 0.1.57-alpha.62

### Patch Changes

- 0f08180: Update docs for mastra dev

## 0.1.57-alpha.61

### Patch Changes

- 689b529: fix mastra dev for windows

## 0.1.57-alpha.60

### Patch Changes

- cc5bd40: Fix playground agent chat losing some chat during redirect
- 002d6d8: add memory to playground agent
- Updated dependencies [e608d8c]
- Updated dependencies [002d6d8]
  - @mastra/core@0.1.27-alpha.45

## 0.1.57-alpha.59

### Patch Changes

- e5e2bb4: Configure vercel deployment project name

## 0.1.57-alpha.58

### Patch Changes

- 1d88043: Fix tools bundling

## 0.1.57-alpha.57

### Patch Changes

- 79a464e: Update cli, dane, stabilityai builds.
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- Updated dependencies [2fa7f53]
  - @mastra/core@0.1.27-alpha.44

## 0.1.57-alpha.56

### Patch Changes

- b135410: fix- mastra post install
- d6d8159: Workflow graph diagram
- 505d385: playground breadcrumb navigation
- Updated dependencies [2e099d2]
- Updated dependencies [d6d8159]
  - @mastra/core@0.1.27-alpha.43

## 0.1.57-alpha.55

### Patch Changes

- f4ae8dd: dev playground, support multiple tool dirs

## 0.1.57-alpha.54

### Patch Changes

- Updated dependencies [4a54c82]
  - @mastra/core@0.1.27-alpha.42

## 0.1.57-alpha.53

### Patch Changes

- de279d5: update apiKey

## 0.1.57-alpha.52

### Patch Changes

- 1b321d5: Get all tools

## 0.1.57-alpha.51

### Patch Changes

- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- Updated dependencies [5cdfb88]
  - @mastra/core@0.1.27-alpha.41

## 0.1.57-alpha.50

### Patch Changes

- ba2437d: one central cli dev playground app
- 8890cac: group mastra dev playground tools

## 0.1.57-alpha.49

### Patch Changes

- Updated dependencies [9029796]
  - @mastra/core@0.1.27-alpha.40

## 0.1.57-alpha.48

### Patch Changes

- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- Updated dependencies [2b01511]
  - @mastra/core@0.1.27-alpha.39

## 0.1.57-alpha.47

### Patch Changes

- a61be33: update readme

## 0.1.57-alpha.46

### Patch Changes

- Updated dependencies [f031a1f]
  - @mastra/core@0.1.27-alpha.38

## 0.1.57-alpha.45

### Patch Changes

- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- b5393f1: New example: Dane and many fixes to make it work
- d1e3623: Refactor CLI and improve engine commands
- Updated dependencies [c872875]
- Updated dependencies [f6da688]
- Updated dependencies [b5393f1]
  - @mastra/core@0.1.27-alpha.37

## 0.1.57-alpha.44

### Patch Changes

- f187221: bring back cli post install
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- b748d2a: fix error when installing zod in starter
- Updated dependencies [f537e33]
- Updated dependencies [bc40916]
- Updated dependencies [f7d1131]
- Updated dependencies [75bf3f0]
- Updated dependencies [3c4488b]
- Updated dependencies [d38f7a6]
  - @mastra/core@0.1.27-alpha.36

## 0.1.57-alpha.43

### Patch Changes

- 033eda6: More fixes for refactor
- Updated dependencies [033eda6]
  - @mastra/core@0.1.27-alpha.35

## 0.1.57-alpha.42

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- Updated dependencies [837a288]
- Updated dependencies [5811de6]
  - @mastra/core@0.1.27-alpha.34

## 0.1.57-alpha.41

### Patch Changes

- Updated dependencies [e1dd94a]
  - @mastra/core@0.1.27-alpha.33

## 0.1.57-alpha.40

### Patch Changes

- 678ffb4: Add layout with sidebar, update dev endpoints to have /api prefix

## 0.1.57-alpha.39

### Patch Changes

- ba821de: publish cli homepage

## 0.1.57-alpha.38

### Patch Changes

- 3af5866: publish cli post install script

## 0.1.57-alpha.37

### Patch Changes

- 43667fa: postinstall mastra package deps
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- 5d2f4b0: cli shared ui
- Updated dependencies [2712098]
  - @mastra/core@0.1.27-alpha.32

## 0.1.57-alpha.36

### Patch Changes

- fd15221: cli publishing fix

## 0.1.57-alpha.35

### Patch Changes

- a828155: Add prepare script to include node_modules in published package
- Updated dependencies [c2dd6b5]
  - @mastra/core@0.1.27-alpha.31

## 0.1.57-alpha.34

### Patch Changes

- 46e9b7a: bundle mastra dev deps with publish

## 0.1.57-alpha.33

### Patch Changes

- 59f592a: mastra dev open api spec, mastra server templates as code

## 0.1.57-alpha.32

### Patch Changes

- 95e15a9: render agent chat errors

## 0.1.57-alpha.31

### Patch Changes

- f1cb298: rename serve command to dev
- 732a971: create api for sync

## 0.1.57-alpha.30

### Patch Changes

- 43ac982: serve agent chat ui on mastra serve

## 0.1.57-alpha.29

### Patch Changes

- 019d771: throw proper errors in serve

## 0.1.57-alpha.28

### Patch Changes

- 4123324: Fix cli server build
- 5fd3569: Update CLOUDFLARE and NETLIFY servers

## 0.1.57-alpha.27

### Patch Changes

- Updated dependencies [963c15a]
  - @mastra/core@0.1.27-alpha.30

## 0.1.57-alpha.26

### Patch Changes

- Updated dependencies [7d87a15]
  - @mastra/core@0.1.27-alpha.29

## 0.1.57-alpha.25

### Patch Changes

- Updated dependencies [1ebd071]
  - @mastra/core@0.1.27-alpha.28

## 0.1.57-alpha.24

### Patch Changes

- b9f7d2f: Expose memory APIs in mastra serve
- Updated dependencies [cd02c56]
  - @mastra/core@0.1.27-alpha.27

## 0.1.57-alpha.23

### Patch Changes

- 9df6d6e: Fix serve

## 0.1.57-alpha.22

### Patch Changes

- 31ca9fe: fix bugs with init
- 3c2d317: add textObject and streamObject to serve api
- Updated dependencies [d5e12de]
  - @mastra/core@0.1.27-alpha.26

## 0.1.57-alpha.21

### Patch Changes

- 86c9e6b: Added posthog telemetry

## 0.1.57-alpha.20

### Patch Changes

- 56f2163: add proper titles and handle empty list
- Updated dependencies [01502b0]
  - @mastra/core@0.1.27-alpha.25

## 0.1.57-alpha.19

### Patch Changes

- 8e62269: show cli options rather than ascii art

## 0.1.57-alpha.18

### Patch Changes

- Updated dependencies [836f4e3]
  - @mastra/core@0.1.27-alpha.24

## 0.1.57-alpha.17

### Patch Changes

- Updated dependencies [0b826f6]
  - @mastra/core@0.1.27-alpha.23

## 0.1.57-alpha.16

### Patch Changes

- Updated dependencies [7a19083]
  - @mastra/core@0.1.27-alpha.22

## 0.1.57-alpha.15

### Patch Changes

- d863bb3: Fixing mastra engine generate

## 0.1.57-alpha.14

### Patch Changes

- Updated dependencies [5ee2e78]
  - @mastra/core@0.1.27-alpha.21

## 0.1.57-alpha.13

### Patch Changes

- 5abbb24: Added deploy commands, init experience, serve improvements
