# Season 2 Roadmap

## Q2 (starts April 21)

### Priority 0

**OSS**
- **Deployers v2:** We're refactoring deployers for more stability and to fix ongoing bundling issues (this will start earlier 😅)
  - Ward
- **MCP registry support**: You should be able to use MCP servers from a popular MCP registry with Mastra, with a URL (if it's SSE), or via `stdio` or `websockets`
  - Tyler + Nik
- **create-mastra v2:** we need to remove some of the options (like configuring `/src`, and components to install), then add the ability to configure storage
  - Dero

**Cloud**
- **Cloud Template:** ability to install weather agent from cloud (creating a Github repo along the way), without previously having a Github repo
  - Toafeeq + Marvin

### Priority 1a

**OSS**
- **Agent Templates:** Build dynamic agents from a predefined template
  - Abhi
- **Agent → Workflows ❤️:** Being able to call an agent from a workflow step, or a workflow from an agent. Unify the two APIs.
  - Abhi + Tony
- **Workflow Streaming**: Support the AI SDK DataStream protocol, the agent.stream() calls that happen from within a workflow
  - Tony

**Cloud**
- **Cold Starts**: Measure everything and then run a bunch of perf experiments to reduce scheduling / bootup time.
  - Gavin

### Priority 1b

**OSS**
- **Improved Dev Playground:** Add voice, image, files, client tools + clean up the tracing UI
  - Taofeeq
- **Voice Agents:** The examples, APIs, docs for one clear, unified path to build a voice agent
  - Ryan
- **Mastra MCP**: You can run your Mastra instance as an MCP server
  - Daniel
- **Agent Network + UI**: Ship v2 of the AgentNetwork primitive (re-do a lot of things), and incorporate in the playground
  - Abhi + Marvin

**Cloud**
- **Usage Tracking:** instrument backend so that can see number of requests, amount of computer, request times, build size and number, cloud DB usage
  - Gavin
- **MCP Hosting:** If you export Mastra as an MCP server, you can deploy that to cloud
  - Abhi + Tony

## Q3 & beyond

### Priority 2

**OSS**
- Support MCP Spec
- Workflow Provider support
- Memory Config - be able to play with memory in the playground
- Guardrails
- Template Library

**Cloud**
- Billing
- Cloud Job System (Scheduled tasks / UI in Cloud)

### Priority 3

**OSS**
- Workflow UI/UX
- Workflow trace export
- Agent steps / Network steps
- Client Tools
- Prebaked Toolset
- MCP deploys
- CLI deploy to cloud
- Data Explorer

### Priority 4

**OSS**
- Prompt CMS
- Synthetic Data
- Data Sets
- Eval Loop
- Installable Examples in Dev Playground
- Memory features (stream memory, archival, history/compression, quality)
- Storage (migrations, more providers)
- RAG
- Browser tools
