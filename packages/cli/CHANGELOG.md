# mastra

## 0.5.0-alpha.4

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/deployer@0.3.0-alpha.4
  - @mastra/core@0.9.0-alpha.3

## 0.4.10-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/deployer@0.2.10-alpha.3

## 0.4.10-alpha.2

### Patch Changes

- 7184dc5: Add support to pass project path directly to create-mastra and improve tag handling
- Updated dependencies [3527610]
  - @mastra/deployer@0.2.10-alpha.2

## 0.4.10-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/deployer@0.2.10-alpha.1

## 0.4.10-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/deployer@0.2.10-alpha.0

## 0.4.9

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 1ebbfbf: Ability to toggle stream vs generate in playground
- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- ea0725e: make sure to put the geoip argument in the right spot (client init) and not at the properties level
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [9f6f6dd]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [1ebbfbf]
- Updated dependencies [67aff42]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/deployer@0.2.9

## 0.4.9-alpha.7

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/deployer@0.2.9-alpha.7

## 0.4.9-alpha.6

### Patch Changes

- Updated dependencies [67aff42]
  - @mastra/deployer@0.2.9-alpha.6

## 0.4.9-alpha.5

### Patch Changes

- Updated dependencies [9f6f6dd]
  - @mastra/deployer@0.2.9-alpha.5

## 0.4.9-alpha.4

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- ea0725e: make sure to put the geoip argument in the right spot (client init) and not at the properties level
- Updated dependencies [1ebbfbf]
- Updated dependencies [7f1b291]
  - @mastra/deployer@0.2.9-alpha.4
  - @mastra/core@0.8.3-alpha.4

## 0.4.9-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/deployer@0.2.9-alpha.3

## 0.4.9-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/deployer@0.2.9-alpha.2

## 0.4.9-alpha.1

### Patch Changes

- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/deployer@0.2.9-alpha.1
  - @mastra/core@0.8.3-alpha.1

## 0.4.9-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/deployer@0.2.9-alpha.0

## 0.4.8

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- df5989d: Correct playground model setting maxSteps reset value
- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
- Updated dependencies [94cd5c1]
  - @mastra/core@0.8.2
  - @mastra/deployer@0.2.8

## 0.4.8-alpha.1

### Patch Changes

- df5989d: Correct playground model setting maxSteps reset value
- Updated dependencies [94cd5c1]
  - @mastra/deployer@0.2.8-alpha.1

## 0.4.8-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/deployer@0.2.8-alpha.0

## 0.4.7

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/deployer@0.2.7

## 0.4.7-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/deployer@0.2.7-alpha.0

## 0.4.6

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.4.6-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.4.5

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 9f529a4: enable geoip in system properties for analytics
- 9d13790: update playground-ui dynamic form, cleanups
- 13ade6a: update favicon shape
- b08fc42: Fix workflow in getting started
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- c0f6c98: fix flag for disabling geoip
- 789bef3: Make runId optional for workflow startAsync api
- a3f0e90: Update storage initialization to ensure tables are present
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 6330967: Enable route timeout using server options
- b311bb7: fix cli build command to use correct Mastra directory
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- 40720d3: Add support for webcontainers like stackblitz
- 23999d4: Add Design System tokens and components into playground ui
- 706e6aa: Remove unused dependencies
- 8076ecf: Unify workflow watch/start response
- 9e7d46a: Fix scroll issue on playground tools page
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [2135c81]
- Updated dependencies [5ae0180]
- Updated dependencies [05d58cc]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [4c98129]
- Updated dependencies [4c65a57]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [84fe241]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
- Updated dependencies [32ba03c]
- Updated dependencies [d7e08e8]
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
- Updated dependencies [0deb356]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/deployer@0.2.6

## 0.4.5-alpha.11

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 13ade6a: update favicon shape
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- c0f6c98: fix flag for disabling geoip
- 23999d4: Add Design System tokens and components into playground ui
- 9e7d46a: Fix scroll issue on playground tools page

## 0.4.5-alpha.10

### Patch Changes

- b08fc42: Fix workflow in getting started
- 055c4ea: Fix traces page showing e.reduce error
- Updated dependencies [2135c81]
- Updated dependencies [8df4a77]
  - @mastra/deployer@0.2.6-alpha.10
  - @mastra/core@0.8.0-alpha.8

## 0.4.5-alpha.9

### Patch Changes

- 40720d3: Add support for webcontainers like stackblitz
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
  - @mastra/deployer@0.2.6-alpha.9
  - @mastra/core@0.8.0-alpha.7

## 0.4.5-alpha.8

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- a3f0e90: Update storage initialization to ensure tables are present
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- b311bb7: fix cli build command to use correct Mastra directory
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [4c65a57]
- Updated dependencies [a3f0e90]
  - @mastra/deployer@0.2.6-alpha.8
  - @mastra/core@0.8.0-alpha.6

## 0.4.5-alpha.7

### Patch Changes

- 9f529a4: enable geoip in system properties for analytics
- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/deployer@0.2.6-alpha.7

## 0.4.5-alpha.6

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/deployer@0.2.6-alpha.6

## 0.4.5-alpha.5

### Patch Changes

- Updated dependencies [32ba03c]
  - @mastra/deployer@0.2.6-alpha.5

## 0.4.5-alpha.4

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/deployer@0.2.6-alpha.4

## 0.4.5-alpha.3

### Patch Changes

- Updated dependencies [0deb356]
  - @mastra/deployer@0.2.6-alpha.3

## 0.4.5-alpha.2

### Patch Changes

- 706e6aa: Remove unused dependencies
- Updated dependencies [56c31b7]
- Updated dependencies [4c98129]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/deployer@0.2.6-alpha.2

## 0.4.5-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/deployer@0.2.6-alpha.1

## 0.4.5-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [05d58cc]
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/deployer@0.2.6-alpha.0
  - @mastra/core@0.7.1-alpha.0

## 0.4.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- e05e7cc: Add origin to cli tracking
- 214e7ce: Only mark required fields as required on the playground
- 3811029: Add identifying header
- 0b496ff: Load env vars on mastra deploy
- 2134786: Fix traces navigation not working in playground
- Updated dependencies [cdc0498]
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5
  - @mastra/core@0.7.0

## 0.4.4-alpha.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 0.4.4-alpha.3

### Patch Changes

- 2134786: Fix traces navigation not working in playground
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3
  - @mastra/deployer@0.2.5-alpha.3

## 0.4.4-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/deployer@0.2.5-alpha.2

## 0.4.4-alpha.1

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 0b496ff: Load env vars on mastra deploy
- Updated dependencies [cdc0498]
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5-alpha.1
  - @mastra/core@0.7.0-alpha.1

## 0.4.4-alpha.0

### Patch Changes

- e05e7cc: Add origin to cli tracking
- 3811029: Add identifying header
- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/deployer@0.2.5-alpha.0

## 0.4.3

### Patch Changes

- 2348e30: When running pnpm create mastra and selecting to install MCP docs server for Windsurf, the prompt placement was confusing as there was an additional confirm step during initialization later. Now the prompts all happen at the same time. Also added a check so we don't re-install global Windsurf if it's already installed
- 6794797: Check for eval values before inserting into storage
- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [e764fd1]
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [85a2461]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4
  - @mastra/core@0.6.4

## 0.4.3-alpha.2

### Patch Changes

- 6794797: Check for eval values before inserting into storage
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [85a2461]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/deployer@0.2.4-alpha.1

## 0.4.3-alpha.1

### Patch Changes

- 2348e30: When running pnpm create mastra and selecting to install MCP docs server for Windsurf, the prompt placement was confusing as there was an additional confirm step during initialization later. Now the prompts all happen at the same time. Also added a check so we don't re-install global Windsurf if it's already installed

## 0.4.3-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [e764fd1]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4-alpha.0
  - @mastra/core@0.6.4-alpha.0

## 0.4.2

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/deployer@0.2.3
  - @mastra/core@0.6.3

## 0.4.2-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/deployer@0.2.3-alpha.1

## 0.4.2-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/deployer@0.2.3-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 0.4.1

### Patch Changes

- aede1ea: Add non english support to weather example
- 2f6a8b6: Update port handling in dev command to ensure CLI port takes precedence over environment variables and add warning when overriding PORT environment variable.
- 010fc45: Fix storage init stuck
- Updated dependencies [4e6732b]
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/deployer@0.2.2
  - @mastra/core@0.6.2

## 0.4.1-alpha.2

### Patch Changes

- 010fc45: Fix storage init stuck

## 0.4.1-alpha.1

### Patch Changes

- 2f6a8b6: Update port handling in dev command to ensure CLI port takes precedence over environment variables and add warning when overriding PORT environment variable.
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/deployer@0.2.2-alpha.1

## 0.4.1-alpha.0

### Patch Changes

- aede1ea: Add non english support to weather example
- Updated dependencies [4e6732b]
  - @mastra/deployer@0.2.2-alpha.0

## 0.4.0

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 5052613: Added a new `mastra create --project-name <string>` flag so coder agents can create new Mastra projects with a one line command.
- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 1405e46: update the Groq model the create-mastra@latest sets
- da8d9bb: Enable public dir copying if it exists
- 9ba1e97: update playground ui for mastra and create-mastra
- 5baf1ec: animate new traces
- 65f2a4c: Add Mastra Docs MCP to the pnpm create mastra TUI with the option to install in Cursor or Windsurf
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [da8d9bb]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/deployer@0.2.1
  - @mastra/core@0.6.1

## 0.4.0-alpha.2

### Patch Changes

- da8d9bb: Enable public dir copying if it exists
- 5baf1ec: animate new traces
- 65f2a4c: Add Mastra Docs MCP to the pnpm create mastra TUI with the option to install in Cursor or Windsurf
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [da8d9bb]
- Updated dependencies [9116d70]
  - @mastra/deployer@0.2.1-alpha.2
  - @mastra/core@0.6.1-alpha.2

## 0.4.0-alpha.1

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 5052613: Added a new `mastra create --project-name <string>` flag so coder agents can create new Mastra projects with a one line command.
- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: update playground ui for mastra and create-mastra
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/deployer@0.2.1-alpha.1

## 0.3.2-alpha.0

### Patch Changes

- 1405e46: update the Groq model the create-mastra@latest sets
- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/deployer@0.2.1-alpha.0

## 0.3.1

### Patch Changes

- c49f798: remove hardcoded localhost url in playground
- 63cebd4: Fixed a bug with the new tool discovery feature where a missing tools/index.ts would crash the process
- d3d6fae: Deprecate mastra dev --env flag
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/deployer@0.2.0

## 0.3.1-alpha.1

### Patch Changes

- c49f798: remove hardcoded localhost url in playground
- 63cebd4: Fixed a bug with the new tool discovery feature where a missing tools/index.ts would crash the process
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/deployer@0.2.0-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- d3d6fae: Deprecate mastra dev --env flag
- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/deployer@0.1.9-alpha.0

## 0.3.0

### Minor Changes

- dd7a09a: Added new MCPConfiguration class for managing multiple MCP server tools/toolsets. Fixed a bug where MCPClient env would overwrite PATH env var. Fixed a bug where MCP servers would be killed non-gracefully leading to printing huge errors on every code save when running mastra dev

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 91d2e30: Fix init in non npm project
- 960690d: Improve client-js workflow watch dx
- af7466e: fixes in playground ui
- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- 52e0418: Split up action types between tools and workflows
- a80bdaf: persist data in run tab in dev
- e5149bb: Fix playground-ui agent-evals tab-content
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- 62565c1: --no-timeout npm create mastra flag
- 9035565: Update tools dev playground inputs for different fieldtypes
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
- Updated dependencies [8deb34c]
- Updated dependencies [c2dde91]
- Updated dependencies [5d41958]
- Updated dependencies [144b3d5]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [731dd8a]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/deployer@0.1.8

## 0.3.0-alpha.12

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/deployer@0.1.8-alpha.12

## 0.3.0-alpha.11

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [5d41958]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/deployer@0.1.8-alpha.11
  - @mastra/core@0.5.0-alpha.11

## 0.3.0-alpha.10

### Minor Changes

- dd7a09a: Added new MCPConfiguration class for managing multiple MCP server tools/toolsets. Fixed a bug where MCPClient env would overwrite PATH env var. Fixed a bug where MCP servers would be killed non-gracefully leading to printing huge errors on every code save when running mastra dev

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/deployer@0.1.8-alpha.10

## 0.2.9-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/deployer@0.1.8-alpha.9
  - @mastra/core@0.5.0-alpha.9

## 0.2.9-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/deployer@0.1.8-alpha.8

## 0.2.9-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/deployer@0.1.8-alpha.7

## 0.2.9-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/deployer@0.1.8-alpha.6

## 0.2.9-alpha.5

### Patch Changes

- 91d2e30: Fix init in non npm project
- af7466e: fixes in playground ui
- 52e0418: Split up action types between tools and workflows
- a80bdaf: persist data in run tab in dev
- 9035565: Update tools dev playground inputs for different fieldtypes
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
  - @mastra/deployer@0.1.8-alpha.5

## 0.2.9-alpha.4

### Patch Changes

- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
- Updated dependencies [144b3d5]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/deployer@0.1.8-alpha.4

## 0.2.9-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/deployer@0.1.8-alpha.3

## 0.2.9-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/deployer@0.1.8-alpha.2

## 0.2.9-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content
- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/deployer@0.1.8-alpha.1

## 0.2.9-alpha.0

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 960690d: Improve client-js workflow watch dx
- 62565c1: --no-timeout npm create mastra flag
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c2dde91]
- Updated dependencies [731dd8a]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/deployer@0.1.8-alpha.0

## 0.2.8

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4
  - @mastra/deployer@0.1.7

## 0.2.8-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/deployer@0.1.7-alpha.0

## 0.2.7

### Patch Changes

- 8d4e0d0: build playground-ui with cli
- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- b24970d: Added Mastra svg favicon to playground
- e5a0c67: Fix polling on dev traces
- 7a0866e: Use non-crypto uuid function in playground, to allow for local urls like local.lan:4111 during development
- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [80cdd76]
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
  - @mastra/deployer@0.1.6

## 0.2.7-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/deployer@0.1.6-alpha.4

## 0.2.7-alpha.3

### Patch Changes

- 8d4e0d0: build playground-ui with cli
- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/deployer@0.1.6-alpha.3
  - @mastra/core@0.4.3-alpha.3

## 0.2.7-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2
  - @mastra/deployer@0.1.6-alpha.2

## 0.2.7-alpha.1

### Patch Changes

- e5a0c67: Fix polling on dev traces
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [80cdd76]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1
  - @mastra/deployer@0.1.6-alpha.1

## 0.2.7-alpha.0

### Patch Changes

- b24970d: Added Mastra svg favicon to playground
- 7a0866e: Use non-crypto uuid function in playground, to allow for local urls like local.lan:4111 during development
- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0
  - @mastra/deployer@0.1.6-alpha.0

## 0.2.6

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- 2d68431: Fix mastra server error processing
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 9c1057d: Fix mastra dev back slash issues
- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [8d94c3e]
- Updated dependencies [2d68431]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2
  - @mastra/deployer@0.1.5

## 0.2.6-alpha.3

### Patch Changes

- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 9c1057d: Fix mastra dev back slash issues
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2
  - @mastra/deployer@0.1.5-alpha.3

## 0.2.6-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1
  - @mastra/deployer@0.1.5-alpha.2

## 0.2.6-alpha.1

### Patch Changes

- 2d68431: Fix mastra server error processing
- Updated dependencies [2d68431]
  - @mastra/deployer@0.1.5-alpha.1

## 0.2.6-alpha.0

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0
  - @mastra/deployer@0.1.5-alpha.0

## 0.2.5

### Patch Changes

- 967da43: Logger, transport fixes
- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1
  - @mastra/deployer@0.1.4

## 0.2.4

### Patch Changes

- 13ba53a: Remove cli postinstall script
- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install
- 71cedf8: Allow column resizing on tracing UI
  Fix UI issues in mastra dev agent chat page
- dd3a52b: pass createVersionTag to create mastra deps
- a931e9a: Fix resizer not showing when user has scrolled down the span details column
- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/deployer@0.1.3
  - @mastra/core@0.4.0

## 0.2.4-alpha.2

### Patch Changes

- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1
  - @mastra/deployer@0.1.3-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- 13ba53a: Remove cli postinstall script
- 71cedf8: Allow column resizing on tracing UI
  Fix UI issues in mastra dev agent chat page
- dd3a52b: pass createVersionTag to create mastra deps
- a931e9a: Fix resizer not showing when user has scrolled down the span details column
- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
  - @mastra/deployer@0.1.3-alpha.0
  - @mastra/core@0.4.0-alpha.0

## 0.2.3

### Patch Changes

- 23b2a7a: Fixed a bug when detecting package manager during mastra init where npm would run after pnpm already installed, resulting in errors
- dfe2df9: Fix mastra create workflow starter
- Updated dependencies [f205ede]
  - @mastra/core@0.3.0
  - @mastra/deployer@0.1.2

## 0.2.3-alpha.0

### Patch Changes

- 23b2a7a: Fixed a bug when detecting package manager during mastra init where npm would run after pnpm already installed, resulting in errors
- dfe2df9: Fix mastra create workflow starter

## 0.2.2

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install
- ffbde2b: Fixed issue where "pnpm create mastra" would take so long it would time out

## 0.2.2-alpha.0

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install
- ffbde2b: Fixed issue where "pnpm create mastra" would take so long it would time out

## 0.2.1

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- b0b975d: Update package installation to latest instead of alpha
- bf2e88f: Add instrumentation http to mastra
- 4526a78: Fixed "instrumentation.mjs" not found, and port 4111 in use errors when rebundling in "mastra dev"
- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1
  - @mastra/deployer@0.1.1

## 0.2.1-alpha.0

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- b0b975d: Update package installation to latest instead of alpha
- bf2e88f: Add instrumentation http to mastra
- 4526a78: Fixed "instrumentation.mjs" not found, and port 4111 in use errors when rebundling in "mastra dev"
- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0
  - @mastra/deployer@0.1.1-alpha.0

## 0.2.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 74b3078: Reduce verbosity in workflows API
- 8b416d9: Breaking changes

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- fd15221: cli publishing fix
- c8a8eab: fix some workflow conditions not showing on graph and dev watcher not working
- cc9172a: Clarify functionality of logs tab in dev environment
- f1cb298: rename serve command to dev
- e38b412: Fixes
- 0f08180: Update docs for mastra dev
- a828155: Add prepare script to include node_modules in published package
- 0e2b588: Update cloudflare deployment config
- ba821de: publish cli homepage
- 95e15a9: render agent chat errors
- abdd42d: polish mastra create, fix create-mastra publishing
- f187221: bring back cli post install
- 9d1796d: Fix storage and eval serialization on api
- 3af5866: publish cli post install script
- b9f7d2f: Expose memory APIs in mastra serve
- 9df6d6e: Fix serve
- e27fe69: Add dir to deployer
- 8ae2bbc: Dane publishing
- c4cd3ff: Catch npx mastra dev dependency issue
- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- f79a9ff: Fix example tool execution not workin in dev, add example tool to example agent, add example workflow to main Mastra export
- 7d83b92: Create default storage and move evals towards it
- cc5bd40: Fix playground agent chat losing some chat during redirect
- 813c719: Fix watcher in mastra dev, now listens to all files
- 0209290: Add env to starter gitignore file
- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 97fb0d5: Move playground dependencies out of cli
- dde845f: Fix cli stater files build
- 7344dd7: Fix tool executor ui bugs
- 989833c: Handle rendering workflows without triggerschema on dev playground
- 17608e9: Fix agent generate/stream with structured output
- b97ca96: Tracing into default storage
- ad2cd74: Deploy fix
- 033eda6: More fixes for refactor
- 7babd5c: CLI build and other
- 9066f95: CF deployer fixes
- 884793d: Fix 500 error in memory call, fix threads sidebar in playground agent chat
- 1944807: Unified logger and major step in better logs
- 0091799: Add dev and deploy mastra commands to CLI references in documentation, update build successful message in dev command
- a61be33: update readme
- 43667fa: postinstall mastra package deps
- 019d771: throw proper errors in serve
- b6f9860: watch for changes in user mastra directory and restart server in cli dev
- 1d68b0c: update dane publishing
- 255fc56: create mastra bundle correctly
- 8e62269: show cli options rather than ascii art
- de279d5: update apiKey
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- ad38e98: Fix example code
- 689b529: fix mastra dev for windows
- edd70b5: changeset
- cefd906: cli interactive api key configuration
- 0b74006: Workflow updates
- 7892533: Updated test evals to use Mastra Storage
- 79a464e: Update cli, dane, stabilityai builds.
- 5b5de5e: Instructions playground
- 9c10484: update all packages
- 59f592a: mastra dev open api spec, mastra server templates as code
- 70dabd9: Fix broken publish
- 21fe536: add keyword tags for packages and update readmes
- 31ca9fe: fix bugs with init
- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- ba2437d: one central cli dev playground app
- 1b321d5: Get all tools
- d68b532: Updated debug logs
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- e6d8055: Added Mastra Storage to add and query live evals
- aacfff6: publish new mastra, create-mastra
- a18e96c: Array schemas for dev tool playground
- 1d88043: Fix tools bundling
- b425845: Logger and execa logs
- 85c6935: Fix messages sent not rendering when evals are on
- b135410: fix- mastra post install
- 4123324: Fix cli server build
- d6d8159: Workflow graph diagram
- 606bbbe: Adds -f option to engine commands to specify custom docker config. Updates Engine docs.
- 7db55f6: Install aisdk model provider for in create-mastra init
- c156b63: Add missing mastra deploy server deps
- 188ffa8: Fix cli create not parsing components flag
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- f6ba259: simplify generate api
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- 5d2f4b0: cli shared ui
- e604ddb: Change bundling architecture
- 678ffb4: Add layout with sidebar, update dev endpoints to have /api prefix
- fa3c7cb: Fix trace name on table being too long
- 8890cac: group mastra dev playground tools
- e5e2bb4: Configure vercel deployment project name
- f2c5dfa: update endpoint path
- 002d6d8: add memory to playground agent
- 2b4d224: Publishing
- 6b518fc: Add js banner to mastra dev bundle to fix dynamic import errors
- dc90663: Fix issues in packages
- 6e18618: Generate tsconfig on mastra create
- 505d385: playground breadcrumb navigation
- de60682: Fix playground thread navigation
- 2f2f65e: Fix multipart location tool error with init example
- b80ea8d: Fix bundling of server
- 323e09e: Use 4o-mini in starter example
- 1dbbb49: update netlify and cloudflare server templates
- b748d2a: fix error when installing zod in starter
- 56f2163: add proper titles and handle empty list
- 9db58b8: Update UI to clarify memory usage in agent chat interface
- 43ac982: serve agent chat ui on mastra serve
- 42a2e69: Fix playground error parsing
- 245e3f7: dev playground rebuild/refresh on file changes
- ffa0b63: Fix scrolling issue in mastra dev tools playground UI
- 28dceab: Catch apiKey error in dev
- 3c2d317: add textObject and streamObject to serve api
- c18a0c0: Fix creation of new threads in dev playground
- d863bb3: Fixing mastra engine generate
- 38b7f66: Update deployer logic
- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- b9c7047: Move to non deprecated table name for eval insertion
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- c16b6a1: Fix loading env files in dev
- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- f4ae8dd: dev playground, support multiple tool dirs
- 6cc479d: change cat example
- 04434b6: Create separate logger file
- ec3ea2f: configurable CF worker name
- 732a971: create api for sync
- 327ece7: Updates for ts versions
- b39ea1d: ability to skip wrangler cli installation
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- b5393f1: New example: Dane and many fixes to make it work
- 3296399: Bump version
- 46e9b7a: bundle mastra dev deps with publish
- 215a1c2: Fix bad cli create starter files copying
- d1e3623: Refactor CLI and improve engine commands
- 9fb59d6: changeset
- 2667e66: fix create mastra publishing
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- 5fd3569: Update CLOUDFLARE and NETLIFY servers
- 4f1d1a1: Enforce types ann cleanup package.json
- ee4de15: Dane fixes
- 86c9e6b: Added posthog telemetry
- 202d404: Added instructions when generating evals
- Updated dependencies [2ab57d6]
- Updated dependencies [a1774e7]
- Updated dependencies [f537e33]
- Updated dependencies [291fe57]
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
- Updated dependencies [e27fe69]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [246f06c]
- Updated dependencies [ac8c61a]
- Updated dependencies [82a6d53]
- Updated dependencies [e9d1b47]
- Updated dependencies [bdaf834]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [8fa48b9]
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
- Updated dependencies [5916f9d]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [ad2cd74]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [7babd5c]
- Updated dependencies [a9b5ddf]
- Updated dependencies [9066f95]
- Updated dependencies [4139b43]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [ab01c53]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [8aec8b7]
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
- Updated dependencies [88f18d7]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [1a41fbf]
- Updated dependencies [176bc42]
- Updated dependencies [391d5ea]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [8329f1a]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [a18e96c]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [b425845]
- Updated dependencies [fe3dcb0]
- Updated dependencies [0696eeb]
- Updated dependencies [6780223]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0b96376]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [cfb966f]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [a291824]
- Updated dependencies [eedb829]
- Updated dependencies [8ea426a]
- Updated dependencies [c5f2d50]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [7064554]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [72c280b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [b80ea8d]
- Updated dependencies [a10b7a3]
- Updated dependencies [42a2e69]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [28dceab]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [a5604c4]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [b9c7047]
- Updated dependencies [4a328af]
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
- Updated dependencies [f1e3105]
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
  - @mastra/deployer@0.1.0
  - @mastra/core@0.2.0

## 0.2.0-alpha.171

### Patch Changes

- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- Updated dependencies [391d5ea]
  - @mastra/deployer@0.1.0-alpha.63

## 0.2.0-alpha.170

### Patch Changes

- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- d68b532: Updated debug logs
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
  - @mastra/deployer@0.1.0-alpha.62

## 0.2.0-alpha.169

### Patch Changes

- 5b5de5e: Instructions playground
- b9c7047: Move to non deprecated table name for eval insertion
- Updated dependencies [b9c7047]
  - @mastra/deployer@0.1.0-alpha.61

## 0.2.0-alpha.168

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109
  - @mastra/deployer@0.1.0-alpha.60

## 0.2.0-alpha.167

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108
  - @mastra/deployer@0.1.0-alpha.59

## 0.2.0-alpha.166

### Patch Changes

- Updated dependencies [8fa48b9]
- Updated dependencies [66a5392]
  - @mastra/deployer@0.1.0-alpha.58
  - @mastra/core@0.2.0-alpha.107

## 0.2.0-alpha.165

### Patch Changes

- de60682: Fix playground thread navigation
- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
- Updated dependencies [4a328af]
  - @mastra/core@0.2.0-alpha.106
  - @mastra/deployer@0.1.0-alpha.57

## 0.2.0-alpha.164

### Patch Changes

- Updated dependencies [246f06c]
  - @mastra/deployer@0.1.0-alpha.56

## 0.2.0-alpha.163

### Patch Changes

- fa3c7cb: Fix trace name on table being too long
- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105
  - @mastra/deployer@0.1.0-alpha.55

## 0.2.0-alpha.162

### Patch Changes

- b97ca96: Tracing into default storage
- 72d1990: Updated evals table schema
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [6780223]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104
  - @mastra/deployer@0.1.0-alpha.54

## 0.2.0-alpha.161

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103
  - @mastra/deployer@0.1.0-alpha.53

## 0.2.0-alpha.160

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102
  - @mastra/deployer@0.1.0-alpha.52

## 0.2.0-alpha.159

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101
  - @mastra/deployer@0.1.0-alpha.51

## 0.2.0-alpha.158

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api
- Updated dependencies [9d1796d]
  - @mastra/deployer@0.1.0-alpha.50
  - @mastra/core@0.2.0-alpha.100

## 0.2.0-alpha.157

### Patch Changes

- 7d83b92: Create default storage and move evals towards it
- Updated dependencies [7d83b92]
  - @mastra/deployer@0.1.0-alpha.49
  - @mastra/core@0.2.0-alpha.99

## 0.2.0-alpha.156

### Patch Changes

- Updated dependencies [8aec8b7]
  - @mastra/deployer@0.1.0-alpha.48

## 0.2.0-alpha.155

### Patch Changes

- 70dabd9: Fix broken publish
- 202d404: Added instructions when generating evals
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98
  - @mastra/deployer@0.1.0-alpha.47

## 0.2.0-alpha.154

### Patch Changes

- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 85c6935: Fix messages sent not rendering when evals are on
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [a18e96c]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
- Updated dependencies [f1e3105]
  - @mastra/core@0.2.0-alpha.97
  - @mastra/deployer@0.1.0-alpha.46

## 0.2.0-alpha.153

### Minor Changes

- 74b3078: Reduce verbosity in workflows API

### Patch Changes

- 813c719: Fix watcher in mastra dev, now listens to all files
- 7db55f6: Install aisdk model provider for in create-mastra init
- c18a0c0: Fix creation of new threads in dev playground
- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96
  - @mastra/deployer@0.1.0-alpha.45

## 0.2.0-alpha.152

### Patch Changes

- 9fb59d6: changeset
- Updated dependencies [9fb59d6]
  - @mastra/deployer@0.1.0-alpha.44
  - @mastra/core@0.2.0-alpha.95

## 0.2.0-alpha.151

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94
  - @mastra/deployer@0.1.0-alpha.43

## 0.2.0-alpha.150

### Patch Changes

- 0209290: Add env to starter gitignore file
- 42a2e69: Fix playground error parsing
- Updated dependencies [5285356]
- Updated dependencies [42a2e69]
  - @mastra/core@0.2.0-alpha.93
  - @mastra/deployer@0.1.0-alpha.42

## 0.2.0-alpha.149

### Patch Changes

- Updated dependencies [0b96376]
  - @mastra/deployer@0.1.0-alpha.41

## 0.2.0-alpha.148

### Patch Changes

- Updated dependencies [8329f1a]
  - @mastra/deployer@0.1.0-alpha.40

## 0.2.0-alpha.147

### Patch Changes

- Updated dependencies [8ea426a]
  - @mastra/deployer@0.1.0-alpha.39

## 0.2.0-alpha.146

### Patch Changes

- b80ea8d: Fix bundling of server
- Updated dependencies [b80ea8d]
  - @mastra/deployer@0.1.0-alpha.34

## 0.2.0-alpha.145

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- 2f2f65e: Fix multipart location tool error with init example
- Updated dependencies [4d4f6b6]
  - @mastra/deployer@0.1.0-alpha.38
  - @mastra/core@0.2.0-alpha.92

## 0.2.0-alpha.144

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91
  - @mastra/deployer@0.1.0-alpha.37

## 0.2.0-alpha.143

### Patch Changes

- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [82a6d53]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90
  - @mastra/deployer@0.1.0-alpha.36

## 0.2.0-alpha.142

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89
  - @mastra/deployer@0.1.0-alpha.35

## 0.2.0-alpha.141

### Patch Changes

- 323e09e: Use 4o-mini in starter example
- Updated dependencies [ab01c53]
- Updated dependencies [ccbc581]
  - @mastra/deployer@0.1.0-alpha.34
  - @mastra/core@0.2.0-alpha.88

## 0.2.0-alpha.140

### Patch Changes

- c16b6a1: Fix loading env files in dev

## 0.2.0-alpha.139

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87
  - @mastra/deployer@0.1.0-alpha.33

## 0.2.0-alpha.138

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [5916f9d]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86
  - @mastra/deployer@0.1.0-alpha.32

## 0.1.57-alpha.137

### Patch Changes

- Updated dependencies [e9d1b47]
- Updated dependencies [c5f2d50]
  - @mastra/core@0.2.0-alpha.85
  - @mastra/deployer@0.0.1-alpha.31

## 0.1.57-alpha.136

### Patch Changes

- 3296399: Bump version

## 0.1.57-alpha.135

### Patch Changes

- e27fe69: Add dir to deployer
- Updated dependencies [e27fe69]
  - @mastra/deployer@0.0.1-alpha.30

## 0.1.57-alpha.134

### Patch Changes

- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [0696eeb]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84
  - @mastra/deployer@0.0.1-alpha.29

## 0.1.57-alpha.133

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [2ab57d6]
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/deployer@0.0.1-alpha.28
  - @mastra/core@0.2.0-alpha.83

## 0.1.57-alpha.132

### Patch Changes

- Updated dependencies [73d112c]
- Updated dependencies [ac8c61a]
  - @mastra/deployer@0.0.1-alpha.27
  - @mastra/core@0.1.27-alpha.82

## 0.1.57-alpha.131

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81
  - @mastra/deployer@0.0.1-alpha.26

## 0.1.57-alpha.130

### Patch Changes

- ad38e98: Fix example code

## 0.1.57-alpha.129

### Patch Changes

- 188ffa8: Fix cli create not parsing components flag

## 0.1.57-alpha.128

### Patch Changes

- 327ece7: Updates for ts versions
- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80
  - @mastra/deployer@0.0.1-alpha.25

## 0.1.57-alpha.127

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes
- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79
  - @mastra/deployer@0.0.1-alpha.24

## 0.1.57-alpha.126

### Patch Changes

- Updated dependencies [88f18d7]
  - @mastra/deployer@0.0.1-alpha.23

## 0.1.57-alpha.125

### Patch Changes

- 6b518fc: Add js banner to mastra dev bundle to fix dynamic import errors

## 0.1.57-alpha.124

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/deployer@0.0.1-alpha.22
  - @mastra/core@0.1.27-alpha.78

## 0.1.57-alpha.123

### Patch Changes

- c8a8eab: fix some workflow conditions not showing on graph and dev watcher not working
- Updated dependencies [8105fae]
- Updated dependencies [cfb966f]
  - @mastra/core@0.1.27-alpha.77
  - @mastra/deployer@0.0.1-alpha.21

## 0.1.57-alpha.122

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/deployer@0.0.1-alpha.20
  - @mastra/core@0.1.27-alpha.76

## 0.1.57-alpha.121

### Patch Changes

- Updated dependencies [23dcb23]
- Updated dependencies [7064554]
  - @mastra/core@0.1.27-alpha.75
  - @mastra/deployer@0.0.1-alpha.19

## 0.1.57-alpha.120

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74
  - @mastra/deployer@0.0.1-alpha.18

## 0.1.57-alpha.119

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73
  - @mastra/deployer@0.0.1-alpha.17

## 0.1.57-alpha.118

### Patch Changes

- 255fc56: create mastra bundle correctly
- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72
  - @mastra/deployer@0.0.1-alpha.16

## 0.1.57-alpha.117

### Patch Changes

- 884793d: Fix 500 error in memory call, fix threads sidebar in playground agent chat

## 0.1.57-alpha.116

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/deployer@0.0.1-alpha.15
  - @mastra/core@0.1.27-alpha.71

## 0.1.57-alpha.115

### Patch Changes

- 215a1c2: Fix bad cli create starter files copying

## 0.1.57-alpha.114

### Patch Changes

- ad2cd74: Deploy fix
- Updated dependencies [ad2cd74]
  - @mastra/deployer@0.0.1-alpha.14

## 0.1.57-alpha.113

### Patch Changes

- Updated dependencies [a1774e7]
  - @mastra/deployer@0.0.1-alpha.13

## 0.1.57-alpha.112

### Patch Changes

- e604ddb: Change bundling architecture
- 28dceab: Catch apiKey error in dev
- Updated dependencies [28dceab]
  - @mastra/deployer@0.0.1-alpha.12

## 0.1.57-alpha.111

### Patch Changes

- Updated dependencies [bdaf834]
  - @mastra/deployer@0.0.1-alpha.11

## 0.1.57-alpha.110

### Patch Changes

- 04434b6: Create separate logger file
- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70
  - @mastra/deployer@0.0.1-alpha.10

## 0.1.57-alpha.109

### Patch Changes

- 9066f95: CF deployer fixes
- Updated dependencies [9066f95]
  - @mastra/deployer@0.0.1-alpha.9

## 0.1.57-alpha.108

### Patch Changes

- b425845: Logger and execa logs
- Updated dependencies [b425845]
  - @mastra/deployer@0.0.1-alpha.8

## 0.1.57-alpha.107

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 6e18618: Generate tsconfig on mastra create
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/deployer@0.0.1-alpha.7
  - @mastra/core@0.1.27-alpha.69

## 0.1.57-alpha.106

### Patch Changes

- Updated dependencies [291fe57]
- Updated dependencies [1a41fbf]
  - @mastra/deployer@0.0.1-alpha.6

## 0.1.57-alpha.105

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68
  - @mastra/deployer@0.0.1-alpha.5

## 0.1.57-alpha.104

### Patch Changes

- 7babd5c: CLI build and other
- Updated dependencies [7babd5c]
  - @mastra/deployer@0.0.1-alpha.4

## 0.1.57-alpha.103

### Patch Changes

- Updated dependencies [c8ff2f5]
- Updated dependencies [a291824]
  - @mastra/core@0.1.27-alpha.67
  - @mastra/deployer@0.0.1-alpha.3

## 0.1.57-alpha.102

### Patch Changes

- Updated dependencies [a9b5ddf]
- Updated dependencies [72c280b]
  - @mastra/deployer@0.0.1-alpha.2

## 0.1.57-alpha.101

### Patch Changes

- e38b412: Fixes

## 0.1.57-alpha.100

### Patch Changes

- Updated dependencies [4139b43]
- Updated dependencies [a5604c4]
  - @mastra/deployer@0.0.1-alpha.0

## 0.1.57-alpha.99

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66

## 0.1.57-alpha.98

### Patch Changes

- 989833c: Handle rendering workflows without triggerschema on dev playground
- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65

## 0.1.57-alpha.97

### Patch Changes

- 17608e9: Fix agent generate/stream with structured output

## 0.1.57-alpha.96

### Patch Changes

- 97fb0d5: Move playground dependencies out of cli
- 245e3f7: dev playground rebuild/refresh on file changes

## 0.1.57-alpha.95

### Patch Changes

- cc9172a: Clarify functionality of logs tab in dev environment
- 9db58b8: Update UI to clarify memory usage in agent chat interface
- ffa0b63: Fix scrolling issue in mastra dev tools playground UI
- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64

## 0.1.57-alpha.94

### Patch Changes

- b39ea1d: ability to skip wrangler cli installation

## 0.1.57-alpha.93

### Patch Changes

- 0e2b588: Update cloudflare deployment config
- ec3ea2f: configurable CF worker name

## 0.1.57-alpha.92

### Patch Changes

- Updated dependencies [e097800]
  - @mastra/core@0.1.27-alpha.63

## 0.1.57-alpha.91

### Patch Changes

- Updated dependencies [93a3719]
  - @mastra/core@0.1.27-alpha.62

## 0.1.57-alpha.90

### Patch Changes

- c4cd3ff: Catch npx mastra dev dependency issue
- dde845f: Fix cli stater files build
- 2b4d224: Publishing

## 0.1.57-alpha.89

### Patch Changes

- c4cd3ff: Catch npx mastra dev dependency issue
- dde845f: Fix cli stater files build

## 0.1.57-alpha.88

### Patch Changes

- dc90663: Fix issues in packages
- Updated dependencies [dc90663]
  - @mastra/core@0.1.27-alpha.61

## 0.1.57-alpha.87

### Patch Changes

- Updated dependencies [3967e69]
  - @mastra/core@0.1.27-alpha.60

## 0.1.57-alpha.86

### Patch Changes

- 606bbbe: Adds -f option to engine commands to specify custom docker config. Updates Engine docs.
- Updated dependencies [b524c22]
  - @mastra/core@0.1.27-alpha.59

## 0.1.57-alpha.85

### Patch Changes

- Updated dependencies [1874f40]
- Updated dependencies [4b1ce2c]
  - @mastra/core@0.1.27-alpha.58

## 0.1.57-alpha.84

### Patch Changes

- Updated dependencies [fd494a3]
  - @mastra/core@0.1.27-alpha.57

## 0.1.57-alpha.83

### Patch Changes

- Updated dependencies [9f3ab05]
  - @mastra/core@0.1.27-alpha.56

## 0.1.57-alpha.82

### Patch Changes

- 6cc479d: change cat example

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
