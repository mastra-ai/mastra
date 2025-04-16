# create-mastra

## 0.2.9-alpha.0

### Patch Changes

- 7184dc5: Add support to pass project path directly to create-mastra and improve tag handling

## 0.2.8

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS

## 0.2.8-alpha.1

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground

## 0.2.8-alpha.0

### Patch Changes

- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS

## 0.2.7

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- df5989d: Correct playground model setting maxSteps reset value

## 0.2.7-alpha.1

### Patch Changes

- df5989d: Correct playground model setting maxSteps reset value

## 0.2.7-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table

## 0.2.6

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.2.6-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.2.5

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.2.5-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.2.4

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 9d13790: update playground-ui dynamic form, cleanups
- 13ade6a: update favicon shape
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 789bef3: Make runId optional for workflow startAsync api
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 8393832: Handle nested workflow view on workflow graph
- 23999d4: Add Design System tokens and components into playground ui
- 8076ecf: Unify workflow watch/start response
- 9e7d46a: Fix scroll issue on playground tools page
- d16ed18: Make playground-ui dynamic forms better

## 0.2.4-alpha.4

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 13ade6a: update favicon shape
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 23999d4: Add Design System tokens and components into playground ui
- 9e7d46a: Fix scroll issue on playground tools page

## 0.2.4-alpha.3

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error

## 0.2.4-alpha.2

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- d16ed18: Make playground-ui dynamic forms better

## 0.2.4-alpha.1

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph

## 0.2.4-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response

## 0.2.3

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 0b496ff: Load env vars on mastra deploy
- 2134786: Fix traces navigation not working in playground

## 0.2.3-alpha.2

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 0.2.3-alpha.1

### Patch Changes

- 2134786: Fix traces navigation not working in playground

## 0.2.3-alpha.0

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 0b496ff: Load env vars on mastra deploy

## 0.2.2

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.2.2-alpha.1

### Patch Changes

- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph

## 0.2.2-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.2.1

### Patch Changes

- 404640e: AgentNetwork changeset

## 0.2.1-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset

## 0.2.0

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 0f24546: Add google as a new LLM provider option in project creation
- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: update playground ui for mastra and create-mastra
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text

## 0.2.0-alpha.2

### Patch Changes

- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text

## 0.2.0-alpha.1

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: update playground ui for mastra and create-mastra

## 0.1.10-alpha.0

### Patch Changes

- 0f24546: Add google as a new LLM provider option in project creation

## 0.1.9

### Patch Changes

- c49f798: remove hardcoded localhost url in playground
- d3d6fae: Deprecate mastra dev --env flag

## 0.1.9-alpha.1

### Patch Changes

- c49f798: remove hardcoded localhost url in playground

## 0.1.9-alpha.0

### Patch Changes

- d3d6fae: Deprecate mastra dev --env flag

## 0.1.8

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 91d2e30: Fix init in non npm project
- 960690d: Improve client-js workflow watch dx
- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- a80bdaf: persist data in run tab in dev
- e5149bb: Fix playground-ui agent-evals tab-content
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- 62565c1: --no-timeout npm create mastra flag
- 9035565: Update tools dev playground inputs for different fieldtypes
- af7466e: fix playground issues
- fd4a1d7: Update cjs bundling to make sure files are split

## 0.1.8-alpha.5

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground

## 0.1.8-alpha.4

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- fd4a1d7: Update cjs bundling to make sure files are split

## 0.1.8-alpha.3

### Patch Changes

- 91d2e30: Fix init in non npm project
- a80bdaf: persist data in run tab in dev
- 9035565: Update tools dev playground inputs for different fieldtypes
- af7466e: fix playground issues

## 0.1.8-alpha.2

### Patch Changes

- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking

## 0.1.8-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content

## 0.1.8-alpha.0

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 960690d: Improve client-js workflow watch dx
- 62565c1: --no-timeout npm create mastra flag

## 0.1.7

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- bb4f447: Add support for commonjs

## 0.1.7-alpha.0

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- bb4f447: Add support for commonjs

## 0.1.6

### Patch Changes

- 2d68431: Fix mastra server error processing

## 0.1.6-alpha.0

### Patch Changes

- 2d68431: Fix mastra server error processing

## 0.1.5

### Patch Changes

- 967da43: Logger, transport fixes

## 0.1.4

### Patch Changes

- 13ba53a: Remove cli postinstall script
- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install
- 5c7b8db: create-mastra version tag discovery
- cd80117: pnpm create mastra versionTag discovery
- dd3a52b: pass createVersionTag to create mastra deps

## 0.1.4-alpha.3

### Patch Changes

- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install

## 0.1.4-alpha.2

### Patch Changes

- cd80117: pnpm create mastra versionTag discovery

## 0.1.4-alpha.1

### Patch Changes

- 5c7b8db: create-mastra version tag discovery

## 0.1.4-alpha.0

### Patch Changes

- 13ba53a: Remove cli postinstall script
- dd3a52b: pass createVersionTag to create mastra deps

## 0.1.3

### Patch Changes

- dfe2df9: Fix mastra create workflow starter

## 0.1.3-alpha.0

### Patch Changes

- dfe2df9: Fix mastra create workflow starter

## 0.1.2

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install

## 0.1.2-alpha.0

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install

## 0.1.1

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- b0b975d: Update package installation to latest instead of alpha

## 0.1.1-alpha.0

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- b0b975d: Update package installation to latest instead of alpha

## 0.1.0

### Minor Changes

- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes
- 3e9f0ca: Improve package size

### Patch Changes

- abdd42d: polish mastra create, fix create-mastra publishing
- 7344dd7: Fix tool executor ui bugs
- b97ca96: Tracing into default storage
- 9c10484: new create-mastra version
- 1d68b0c: update dane publishing
- 255fc56: create mastra bundle correctly
- edd70b5: changeset
- cefd906: cli interactive api key configuration
- 0b74006: Workflow updates
- 9c10484: update all packages
- 70dabd9: Fix broken publish
- 21fe536: add keyword tags for packages and update readmes
- aacfff6: publish new mastra, create-mastra
- a18e96c: Array schemas for dev tool playground
- b425845: Logger and execa logs
- 7db55f6: Install aisdk model provider for in create-mastra init
- 188ffa8: Fix cli create not parsing components flag
- 932d86c: Fix build
- de60682: Fix playground thread navigation
- fee6d63: Republish
- c18a0c0: Fix creation of new threads in dev playground
- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps
- 04434b6: Create separate logger file
- 215a1c2: Fix bad cli create starter files copying
- 9fb59d6: changeset
- 2667e66: fix create mastra publishing
- 4f1d1a1: Enforce types ann cleanup package.json

## 0.1.0-alpha.40

### Patch Changes

- de60682: Fix playground thread navigation

## 0.1.0-alpha.39

### Patch Changes

- b97ca96: Tracing into default storage
- fee6d63: Republish

## 0.1.0-alpha.38

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json

## 0.1.0-alpha.37

### Patch Changes

- 70dabd9: Fix broken publish

## 0.1.0-alpha.36

### Patch Changes

- a18e96c: Array schemas for dev tool playground

## 0.1.0-alpha.35

### Patch Changes

- 7db55f6: Install aisdk model provider for in create-mastra init
- c18a0c0: Fix creation of new threads in dev playground

## 0.1.0-alpha.34

### Patch Changes

- 9fb59d6: changeset

## 0.1.0-alpha.33

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: new create-mastra version
- 9c10484: update all packages

## 0.1.0-alpha.32

### Minor Changes

- 5916f9d: Update deps from fixed to ^

## 0.1.0-alpha.31

### Patch Changes

- 188ffa8: Fix cli create not parsing components flag

## 0.1.0-alpha.30

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes

## 0.1.0-alpha.29

### Patch Changes

- 255fc56: create mastra bundle correctly

## 0.1.0-alpha.28

### Patch Changes

- 215a1c2: Fix bad cli create starter files copying

## 0.1.0-alpha.27

### Patch Changes

- 932d86c: Fix build

## 0.1.0-alpha.26

### Patch Changes

- 04434b6: Create separate logger file

## 0.1.0-alpha.25

### Patch Changes

- b425845: Logger and execa logs

## 0.1.0-alpha.24

### Minor Changes

- 3e9f0ca: Improve package size

## 0.1.0-alpha.23

### Patch Changes

- Updated dependencies [c4cd3ff]
- Updated dependencies [dde845f]
- Updated dependencies [2b4d224]
  - mastra@0.1.57-alpha.90

## 0.1.0-alpha.22

### Patch Changes

- Updated dependencies [c4cd3ff]
- Updated dependencies [dde845f]
  - mastra@0.1.57-alpha.89

## 0.1.0-alpha.21

### Patch Changes

- Updated dependencies [dc90663]
  - mastra@0.1.57-alpha.88

## 0.1.0-alpha.20

### Patch Changes

- mastra@0.1.57-alpha.87

## 0.1.0-alpha.19

### Patch Changes

- Updated dependencies [606bbbe]
  - mastra@0.1.57-alpha.86

## 0.1.0-alpha.18

### Patch Changes

- mastra@0.1.57-alpha.85

## 0.1.0-alpha.17

### Patch Changes

- mastra@0.1.57-alpha.84

## 0.1.0-alpha.16

### Patch Changes

- mastra@0.1.57-alpha.83

## 0.1.0-alpha.15

### Patch Changes

- Updated dependencies [6cc479d]
  - mastra@0.1.57-alpha.82

## 0.1.0-alpha.14

### Patch Changes

- 0b74006: Workflow updates
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - mastra@0.1.57-alpha.81

## 0.1.0-alpha.13

### Patch Changes

- mastra@0.1.57-alpha.80

## 0.1.0-alpha.12

### Patch Changes

- mastra@0.1.57-alpha.79

## 0.1.0-alpha.11

### Patch Changes

- Updated dependencies [f79a9ff]
  - mastra@0.1.57-alpha.78

## 0.1.0-alpha.10

### Patch Changes

- Updated dependencies [538a136]
  - mastra@0.1.57-alpha.77

## 0.1.0-alpha.9

### Patch Changes

- cefd906: cli interactive api key configuration
- Updated dependencies [b6f9860]
- Updated dependencies [cefd906]
  - mastra@0.1.57-alpha.76

## 0.1.0-alpha.8

### Patch Changes

- mastra@0.1.57-alpha.75

## 0.1.0-alpha.7

### Patch Changes

- edd70b5: changeset
- Updated dependencies [edd70b5]
  - mastra@0.1.57-alpha.74

## 0.1.0-alpha.6

### Patch Changes

- aacfff6: publish new mastra, create-mastra
- Updated dependencies [aacfff6]
  - mastra@0.1.57-alpha.73

## 0.1.0-alpha.5

### Patch Changes

- 2667e66: fix create mastra publishing
- Updated dependencies [2667e66]
  - mastra@0.1.57-alpha.72

## 0.1.0-alpha.4

### Patch Changes

- 1d68b0c: update dane publishing
- Updated dependencies [1d68b0c]
  - mastra@0.1.57-alpha.71

## 0.1.0-alpha.3

### Patch Changes

- abdd42d: polish mastra create, fix create-mastra publishing
- Updated dependencies [abdd42d]
  - mastra@0.1.57-alpha.70

## 0.1.0-alpha.2

### Patch Changes

- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps
- Updated dependencies [32cd966]
  - mastra@0.1.57-alpha.69

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [c156b63]
  - mastra@0.1.57-alpha.68
