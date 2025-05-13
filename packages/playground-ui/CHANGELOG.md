# @mastra/playground-ui

## 5.0.4-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c2f9e60]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/client-js@0.1.22-alpha.3

## 5.0.4-alpha.2

### Patch Changes

- Updated dependencies [b4c6c87]
- Updated dependencies [3171b5b]
- Updated dependencies [c2b980b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/client-js@0.1.22-alpha.2
  - @mastra/core@0.9.4-alpha.2

## 5.0.4-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/client-js@0.1.22-alpha.1

## 5.0.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/client-js@0.1.22-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 5.0.3

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 62c9e7d: Fix disappearing tool calls in streaming
- d2dfc37: Fix autoform number form default value
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [36eb1aa]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [62c9e7d]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/client-js@0.1.21

## 5.0.3-alpha.1

### Patch Changes

- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [36eb1aa]
- Updated dependencies [9cd1a46]
- Updated dependencies [62c9e7d]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/client-js@0.1.21-alpha.1

## 5.0.3-alpha.0

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- d2dfc37: Fix autoform number form default value
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/client-js@0.1.21-alpha.0
  - @mastra/core@0.9.3-alpha.0

## 5.0.2

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- 33b84fd: fix showing sig digits in trace / span duration
- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 5b43dd0: revamp ui for threads
- fba031f: Show traces for vNext workflow
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2429c74]
- Updated dependencies [fba031f]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/client-js@0.1.20
  - @mastra/core@0.9.2

## 5.0.2-alpha.6

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/client-js@0.1.20-alpha.6

## 5.0.2-alpha.5

### Patch Changes

- fba031f: Show traces for vNext workflow
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/client-js@0.1.20-alpha.5

## 5.0.2-alpha.4

### Patch Changes

- 5b43dd0: revamp ui for threads
- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/client-js@0.1.20-alpha.4

## 5.0.2-alpha.3

### Patch Changes

- 33b84fd: fix showing sig digits in trace / span duration
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/client-js@0.1.20-alpha.3

## 5.0.2-alpha.2

### Patch Changes

- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/client-js@0.1.20-alpha.2

## 5.0.2-alpha.1

### Patch Changes

- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
- Updated dependencies [2429c74]
  - @mastra/client-js@0.1.20-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 5.0.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/client-js@0.1.20-alpha.0
  - @mastra/core@0.9.2-alpha.0

## 5.0.1

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 70124e1: revamp the ui for traces
- 3b74a74: add badge for failure / successful traces
- 05806e3: revamp the UI of the chat in playground
- 926821d: Fix triggerSchema default not showing in workflow ui
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- ca665d3: fix the ui for smaller screen regarding traces
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- 5a66ced: add click on trace row
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
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1
  - @mastra/client-js@0.1.19

## 5.0.1-alpha.9

### Patch Changes

- ca665d3: fix the ui for smaller screen regarding traces

## 5.0.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/client-js@0.1.19-alpha.8

## 5.0.1-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/client-js@0.1.19-alpha.7

## 5.0.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/client-js@0.1.19-alpha.6

## 5.0.1-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/client-js@0.1.19-alpha.5

## 5.0.1-alpha.4

### Patch Changes

- 3b74a74: add badge for failure / successful traces
- 5a66ced: add click on trace row
- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/client-js@0.1.19-alpha.4

## 5.0.1-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3
  - @mastra/client-js@0.1.19-alpha.3

## 5.0.1-alpha.2

### Patch Changes

- 70124e1: revamp the ui for traces
- 926821d: Fix triggerSchema default not showing in workflow ui
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/client-js@0.1.19-alpha.2

## 5.0.1-alpha.1

### Patch Changes

- 05806e3: revamp the UI of the chat in playground
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1
  - @mastra/client-js@0.1.19-alpha.1

## 5.0.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/client-js@0.1.19-alpha.0

## 5.0.0

### Patch Changes

- bdbde72: Sync DS components with Cloud
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
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0
  - @mastra/client-js@0.1.18

## 5.0.0-alpha.8

### Patch Changes

- bdbde72: Sync DS components with Cloud
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8
  - @mastra/client-js@0.1.18-alpha.8

## 5.0.0-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/client-js@0.1.18-alpha.7

## 5.0.0-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/client-js@0.1.18-alpha.6

## 5.0.0-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/client-js@0.1.18-alpha.5

## 5.0.0-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4
  - @mastra/client-js@0.1.18-alpha.4

## 5.0.0-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3
  - @mastra/client-js@0.1.18-alpha.3

## 4.0.5-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/client-js@0.1.18-alpha.2

## 4.0.5-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/client-js@0.1.18-alpha.1

## 4.0.5-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/client-js@0.1.18-alpha.0

## 4.0.4

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/client-js@0.1.17

## 4.0.4-alpha.6

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/client-js@0.1.17-alpha.5

## 4.0.4-alpha.5

### Patch Changes

- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.

## 4.0.4-alpha.4

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4
  - @mastra/client-js@0.1.17-alpha.4

## 4.0.4-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/client-js@0.1.17-alpha.3

## 4.0.4-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/client-js@0.1.17-alpha.2

## 4.0.4-alpha.1

### Patch Changes

- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
  - @mastra/core@0.8.3-alpha.1
  - @mastra/client-js@0.1.17-alpha.1

## 4.0.4-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/client-js@0.1.17-alpha.0

## 4.0.3

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2
  - @mastra/client-js@0.1.16

## 4.0.3-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/client-js@0.1.16-alpha.0

## 4.0.2

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/client-js@0.1.15

## 4.0.2-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/client-js@0.1.15-alpha.0

## 4.0.1

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.1-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.0

### Patch Changes

- 5ae0180: Removed prefixed doc references
- a4a1151: Fix playground freezing when buffer is passed between steps
- 7bdbb64: Show no input when attributs are empty
- 9d13790: update playground-ui dynamic form, cleanups
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 8393832: Handle nested workflow view on workflow graph
- 23999d4: Add Design System tokens and components into playground ui
- 8076ecf: Unify workflow watch/start response
- d16ed18: Make playground-ui dynamic forms better
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
- Updated dependencies [055c4ea]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [5646a01]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [bffd64f]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/client-js@0.1.14

## 4.0.0-alpha.9

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 23999d4: Add Design System tokens and components into playground ui

## 4.0.0-alpha.8

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- Updated dependencies [055c4ea]
- Updated dependencies [bffd64f]
- Updated dependencies [8df4a77]
  - @mastra/client-js@0.1.14-alpha.8
  - @mastra/core@0.8.0-alpha.8

## 4.0.0-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7
  - @mastra/client-js@0.1.14-alpha.7

## 4.0.0-alpha.6

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [a3f0e90]
- Updated dependencies [5646a01]
  - @mastra/core@0.8.0-alpha.6
  - @mastra/client-js@0.1.14-alpha.6

## 4.0.0-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/client-js@0.1.14-alpha.5

## 4.0.0-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/client-js@0.1.14-alpha.4

## 4.0.0-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 7bdbb64: Show no input when attributs are empty
- 8393832: Handle nested workflow view on workflow graph
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/client-js@0.1.14-alpha.3

## 4.0.0-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/client-js@0.1.14-alpha.2

## 4.0.0-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/client-js@0.1.14-alpha.1

## 3.0.1-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0
  - @mastra/client-js@0.1.14-alpha.0

## 3.0.0

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 2134786: Fix traces navigation not working in playground
- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [3811029]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0
  - @mastra/client-js@0.1.13

## 3.0.0-alpha.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 3.0.0-alpha.3

### Patch Changes

- 2134786: Fix traces navigation not working in playground
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/client-js@0.1.13-alpha.3
  - @mastra/core@0.7.0-alpha.3

## 3.0.0-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/client-js@0.1.13-alpha.2

## 3.0.0-alpha.1

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1
  - @mastra/client-js@0.1.13-alpha.1

## 2.0.5-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [3811029]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/client-js@0.1.13-alpha.0

## 2.0.4

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4
  - @mastra/client-js@0.1.12

## 2.0.4-alpha.1

### Patch Changes

- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/client-js@0.1.12-alpha.1

## 2.0.4-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0
  - @mastra/client-js@0.1.12-alpha.0

## 2.0.3

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/client-js@0.1.11
  - @mastra/core@0.6.3

## 2.0.3-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/client-js@0.1.11-alpha.1

## 2.0.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/client-js@0.1.11-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 2.0.2

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2
  - @mastra/client-js@0.1.10

## 2.0.2-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/client-js@0.1.10-alpha.0

## 2.0.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- 9ba1e97: fix loading state for evals page
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1
  - @mastra/client-js@0.1.9

## 2.0.1-alpha.2

### Patch Changes

- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2
  - @mastra/client-js@0.1.9-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: fix loading state for evals page
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/client-js@0.1.9-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/client-js@0.1.9-alpha.0

## 2.0.0

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/client-js@0.1.8

## 2.0.0-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/client-js@0.1.8-alpha.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/client-js@0.1.8-alpha.0

## 1.0.0

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- e5149bb: Fix playground-ui agent-evals tab-content
- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
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
- Updated dependencies [960690d]
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
  - @mastra/client-js@0.1.7

## 1.0.0-alpha.12

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/client-js@0.1.7-alpha.12

## 1.0.0-alpha.11

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11
  - @mastra/client-js@0.1.7-alpha.11

## 1.0.0-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/client-js@0.1.7-alpha.10

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9
  - @mastra/client-js@0.1.7-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/client-js@0.1.7-alpha.8

## 1.0.0-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/client-js@0.1.7-alpha.7

## 1.0.0-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/client-js@0.1.7-alpha.6

## 1.0.0-alpha.5

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
  - @mastra/client-js@0.1.7-alpha.5

## 1.0.0-alpha.4

### Patch Changes

- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/client-js@0.1.7-alpha.4

## 1.0.0-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/client-js@0.1.7-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/client-js@0.1.7-alpha.2

## 1.0.0-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content
- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/client-js@0.1.7-alpha.1

## 1.0.0-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [960690d]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/client-js@0.1.7-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4
  - @mastra/client-js@0.1.6

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/client-js@0.1.6-alpha.0

## 0.0.1

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
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
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/client-js@0.1.5

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/client-js@0.1.5-alpha.4

## 0.0.1-alpha.2

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3
  - @mastra/client-js@0.1.5-alpha.3
