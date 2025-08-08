# create-mastra

## 0.10.21-alpha.2

### Patch Changes

- 77b6cfe: Use just modelId for gpt-5 check
- 33da97c: Set temperature to 1 for gpt-5 model in playground
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.

## 0.10.21-alpha.1

## 0.10.21-alpha.0

### Patch Changes

- 7aad750: Fix tool ui showing after message when chat is refreshed

## 0.10.20

## 0.10.20-alpha.0

## 0.10.19

## 0.10.19-alpha.2

## 0.10.19-alpha.1

## 0.10.19-alpha.0

## 0.10.15

### Patch Changes

- ad04455: Missed changeset in last release, needed to include create-mastra

## 0.10.15-alpha.0

### Patch Changes

- ad04455: Missed changeset in last release, needed to include create-mastra

## 0.10.14

### Patch Changes

- f442224: speech to text using voice config
- d8dec5e: add a cta to invite to deploy to cloud
- 6336993: Fix workflow input form overflow
- 89d2f4e: add TTS to the playground

## 0.10.14-alpha.1

### Patch Changes

- 6336993: Fix workflow input form overflow

## 0.10.14-alpha.0

### Patch Changes

- f442224: speech to text using voice config
- d8dec5e: add a cta to invite to deploy to cloud
- 89d2f4e: add TTS to the playground

## 0.10.13

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 0bf0bc8: fix link in shared components + add e2e tests
- 2affc57: Fix output type of network loop
- f6c4d75: fix date picker on change
- 59f0dcd: Add light background color for step statuses
- 698518b: Allow external templates from github
- cf8d497: factorize tabs component between cloud and core
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- 09464dd: Share AgentMetadata component with cloud
- 80692d5: refactor: sharing only the UI and not data fetching for traces

## 0.10.13-alpha.2

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 2affc57: Fix output type of network loop
- f6c4d75: fix date picker on change
- 698518b: Allow external templates from github
- 09464dd: Share AgentMetadata component with cloud

## 0.10.13-alpha.1

### Patch Changes

- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 59f0dcd: Add light background color for step statuses
- cf8d497: factorize tabs component between cloud and core
- 80692d5: refactor: sharing only the UI and not data fetching for traces

## 0.10.13-alpha.0

### Patch Changes

- 0bf0bc8: fix link in shared components + add e2e tests
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud

## 0.10.12

### Patch Changes

- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 794d9f3: Fix thread creation in playground
- aa9528a: Display reasoning in playground
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents

## 0.10.12-alpha.2

### Patch Changes

- 794d9f3: Fix thread creation in playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents

## 0.10.12-alpha.1

### Patch Changes

- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud

## 0.10.12-alpha.0

### Patch Changes

- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- aa9528a: Display reasoning in playground
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground

## 0.10.11

### Patch Changes

- 640f47e: move agent model settings into agent settings

## 0.10.11-alpha.0

### Patch Changes

- 640f47e: move agent model settings into agent settings

## 0.10.10

### Patch Changes

- af9e40e: Map log level number to string value
- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- 4219597: add JSON input close to form input
- b790fd1: Use SerializedStepFlowEntry in playground
- a7a836a: Highlight send event button
- 18ca936: Update rollup config for create-mastra

## 0.10.10-alpha.3

### Patch Changes

- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps

## 0.10.10-alpha.2

### Patch Changes

- 4219597: add JSON input close to form input
- 18ca936: Update rollup config for create-mastra

## 0.10.10-alpha.1

### Patch Changes

- a7a836a: Highlight send event button

## 0.10.10-alpha.0

### Patch Changes

- af9e40e: Map log level number to string value
- b790fd1: Use SerializedStepFlowEntry in playground

## 0.10.9

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui

## 0.10.9-alpha.0

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui

## 0.10.8

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- f78f399: Make AgentModelSettings shareable between cloud and playground
- 57929df: agent network display

## 0.10.8-alpha.0

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- f78f399: Make AgentModelSettings shareable between cloud and playground
- 57929df: agent network display

## 0.10.7

### Patch Changes

- a344ac7: Fix tool streaming in agent network

## 0.10.7-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network

## 0.10.6

### Patch Changes

- 5d74aab: vNext network in playground
- 9102d89: Fix final output not showing on playground for previously suspended steps
- 21ffb97: Make dynamic form handle schema better
- f9b4350: fix icons not showing on all agents

## 0.10.6-alpha.3

### Patch Changes

- f9b4350: fix icons not showing on all agents

## 0.10.6-alpha.2

### Patch Changes

- 5d74aab: vNext network in playground

## 0.10.6-alpha.1

### Patch Changes

- 21ffb97: Make dynamic form handle schema better

## 0.10.6-alpha.0

### Patch Changes

- 9102d89: Fix final output not showing on playground for previously suspended steps

## 0.10.5

### Patch Changes

- 02560d4: lift evals fetching to the playground package instead
- 63f6b7d: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`pino@^9.7.0` ↗︎](https://www.npmjs.com/package/pino/v/9.7.0) (from `^9.6.0`, in `dependencies`)
  - Updated dependency [`posthog-node@^4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `^4.10.1`, in `dependencies`)
- 5f2aa3e: Move workflow hooks to playground
- 44ba52d: Add proper error message when installation of mastra fails
- 311132e: move useWorkflow to playground instead of playground-ui
- 3270d9d: Fix runtime context being undefined
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- fc677d7: For final result for a workflow

## 0.10.5-alpha.2

### Patch Changes

- 5f2aa3e: Move workflow hooks to playground

## 0.10.5-alpha.1

### Patch Changes

- 44ba52d: Add proper error message when installation of mastra fails
- 3270d9d: Fix runtime context being undefined
- fc677d7: For final result for a workflow

## 0.10.5-alpha.0

### Patch Changes

- 02560d4: lift evals fetching to the playground package instead
- 63f6b7d: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`pino@^9.7.0` ↗︎](https://www.npmjs.com/package/pino/v/9.7.0) (from `^9.6.0`, in `dependencies`)
  - Updated dependency [`posthog-node@^4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `^4.10.1`, in `dependencies`)
- 311132e: move useWorkflow to playground instead of playground-ui
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083

## 0.10.4

### Patch Changes

- 1ba421d: fix the tools not showing on workflows attached to agents
- 8725d02: Improve cli by reducing the amount of setups during interactive prompt
- 13c97f9: Save run status, result and error in storage snapshot

## 0.10.3

### Patch Changes

- e719504: don't start posthog when the browser is Brave
- 8f60de4: fix workflow output when the schema is a primitive

## 0.10.3-alpha.1

### Patch Changes

- e719504: don't start posthog when the browser is Brave

## 0.10.3-alpha.0

### Patch Changes

- 8f60de4: fix workflow output when the schema is a primitive

## 0.10.2

### Patch Changes

- 73fec0b: Mastra start cli command"
- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- f73e11b: fix telemetry disabled not working on playground
- 9666468: move the fetch traces call to the playground instead of playground-ui
- 90e96de: Fix: prevent default flag from triggering interactive prompt
- 89a69d0: add a way to go to the given trace of a workflow step
- 6fd77b5: add docs and txt support for multi modal
- 9faee5b: small fixes in the workflows graph
- 631683f: move workflow runs list in playground-ui instead of playground
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- 9a31c09: Highlight steps in nested workflows on workflow graph

## 0.10.2-alpha.6

### Patch Changes

- 90e96de: Fix: prevent default flag from triggering interactive prompt

## 0.10.2-alpha.5

### Patch Changes

- 6fd77b5: add docs and txt support for multi modal
- 631683f: move workflow runs list in playground-ui instead of playground

## 0.10.2-alpha.4

### Patch Changes

- 9666468: move the fetch traces call to the playground instead of playground-ui

## 0.10.2-alpha.3

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run

## 0.10.2-alpha.2

### Patch Changes

- f73e11b: fix telemetry disabled not working on playground

## 0.10.2-alpha.1

### Patch Changes

- 73fec0b: Mastra start cli command"
- f6ddf55: fix traces not showing and reduce API surface from playground ui

## 0.10.2-alpha.0

### Patch Changes

- 89a69d0: add a way to go to the given trace of a workflow step
- 9faee5b: small fixes in the workflows graph
- 9a31c09: Highlight steps in nested workflows on workflow graph

## 0.10.1

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- bed0916: Update default tools path in mastra dev,build
- 3c2dba5: add workflow run list
- 23d56b1: Handle dev server errors, restart, exit
- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 35bb6a3: Allow undefined temprature, topP model setting from playground
- 33f1c64: revamp the experience for workflows
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- 7a32205: add empty states for workflows, agents and mcp servers

## 0.10.1-alpha.5

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream

## 0.10.1-alpha.4

### Patch Changes

- 3c2dba5: add workflow run list
- 33f1c64: revamp the experience for workflows

## 0.10.1-alpha.3

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground

## 0.10.1-alpha.2

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- bed0916: Update default tools path in mastra dev,build
- 23d56b1: Handle dev server errors, restart, exit

## 0.10.1-alpha.1

### Patch Changes

- 7a32205: add empty states for workflows, agents and mcp servers

## 0.10.1-alpha.0

### Patch Changes

- 35bb6a3: Allow undefined temprature, topP model setting from playground

## 0.10.0

### Patch Changes

- bdb7934: fix tools not showing (discoverability)
- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- ae122cc: show the entities ID close to the copy button
- 99552bc: revamp the UI of the tools page
- f2d3352: fix overflow scroll in runtime context
- 95911be: Fixed an issue where if @mastra/core was not released at the same time as create-mastra, create-mastra would match the alpha tag instead of latest tag when running npm create mastra@latest
- db4211d: improve the UI/UX of the runtime context with formatting, copying, docs and syntax highlighting
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 47776b4: update the mcp pages
- fd69cc3: revamp UI of workflow "Run" pane
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- 392a14d: changing the empty state for threads in agent chat
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- d2b595a: a better tools playground page
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input

## 0.3.4-alpha.2

### Patch Changes

- 47776b4: update the mcp pages

## 0.3.4-alpha.1

### Patch Changes

- bdb7934: fix tools not showing (discoverability)
- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- ae122cc: show the entities ID close to the copy button
- f2d3352: fix overflow scroll in runtime context
- 95911be: Fixed an issue where if @mastra/core was not released at the same time as create-mastra, create-mastra would match the alpha tag instead of latest tag when running npm create mastra@latest
- fd69cc3: revamp UI of workflow "Run" pane
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- d2b595a: a better tools playground page
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input

## 0.3.4-alpha.0

### Patch Changes

- 99552bc: revamp the UI of the tools page
- db4211d: improve the UI/UX of the runtime context with formatting, copying, docs and syntax highlighting
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- 392a14d: changing the empty state for threads in agent chat

## 0.3.3

### Patch Changes

- a3435f8: Add node engine to create-mastra project package.json

## 0.3.3-alpha.0

### Patch Changes

- a3435f8: Add node engine to create-mastra project package.json

## 0.3.2

### Patch Changes

- 0db0992: - add new --mcp option to cli
  - add support for mcp in vscode
  - include examples with --default flag
- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 62c9e7d: Fix disappearing tool calls in streaming

## 0.3.2-alpha.1

### Patch Changes

- 62c9e7d: Fix disappearing tool calls in streaming

## 0.3.2-alpha.0

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground

## 0.3.1

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- 33b84fd: fix showing sig digits in trace / span duration
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 8607972: Introduce Mastra lint cli command
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 5b43dd0: revamp ui for threads
- 2429c74: Add get workflow runs api to client-js
- fba031f: Show traces for vNext workflow

## 0.3.1-alpha.5

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces

## 0.3.1-alpha.4

### Patch Changes

- 8607972: Introduce Mastra lint cli command
- fba031f: Show traces for vNext workflow

## 0.3.1-alpha.3

### Patch Changes

- 5b43dd0: revamp ui for threads

## 0.3.1-alpha.2

### Patch Changes

- 33b84fd: fix showing sig digits in trace / span duration
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters

## 0.3.1-alpha.1

### Patch Changes

- 2429c74: Add get workflow runs api to client-js

## 0.3.1-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph

## 0.3.0

### Minor Changes

- e126a44: improve non-interactive mode of the mastra cli and create-mastra by adding --no-example and --dir flags

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 25d3c39: build logs for how to load instrumentation for build output
- 70124e1: revamp the ui for traces
- 3b74a74: add badge for failure / successful traces
- 05806e3: revamp the UI of the chat in playground
- 926821d: Fix triggerSchema default not showing in workflow ui
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- ca665d3: fix the ui for smaller screen regarding traces
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- 5a66ced: add click on trace row
- 8863033: Fix tools api in local dev api
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra

## 0.3.0-alpha.5

### Patch Changes

- ca665d3: fix the ui for smaller screen regarding traces

## 0.3.0-alpha.4

### Patch Changes

- 25d3c39: build logs for how to load instrumentation for build output

## 0.3.0-alpha.3

### Patch Changes

- 3b74a74: add badge for failure / successful traces
- 5a66ced: add click on trace row

## 0.3.0-alpha.2

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces

## 0.3.0-alpha.1

### Patch Changes

- 70124e1: revamp the ui for traces
- 926821d: Fix triggerSchema default not showing in workflow ui
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests

## 0.3.0-alpha.0

### Minor Changes

- e126a44: improve non-interactive mode of the mastra cli and create-mastra by adding --no-example and --dir flags

### Patch Changes

- 05806e3: revamp the UI of the chat in playground
- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 8863033: Fix tools api in local dev api
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra

## 0.2.9

### Patch Changes

- 7e92011: Include tools with deployment builds
- 7184dc5: Add support to pass project path directly to create-mastra and improve tag handling
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- bdbde72: Sync DS components with Cloud

## 0.2.9-alpha.2

### Patch Changes

- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- bdbde72: Sync DS components with Cloud

## 0.2.9-alpha.1

### Patch Changes

- 7e92011: Include tools with deployment builds

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
