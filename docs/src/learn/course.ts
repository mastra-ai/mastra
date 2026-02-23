import type { Course } from './types'

export const course: Course = {
  courseId: 'mastra-101',
  title: 'Build Your First AI Agent with Mastra',
  description:
    "2026 is the decade of agents. They're already in the tools engineers use every day, and teams are asking who can actually build one. Guil Hernandez, with over a decade of experience building and teaching software, walks you through how to build and ship AI agents with Mastra.\n\nYou'll build a Theme Park Companion agent that looks up parks, pulls live wait times, factors in weather, and connects to an MCP server for park hours and crowd data to make better recommendations. By the end you'll have covered agents, tools, workflows, and memory, and have an agent ready to deploy and call from your app.",
  lessons: [
    // Module 1: Getting Started
    {
      slug: '01-build-ai-agents-with-mastra',
      title: 'Build AI Agents with Mastra',
      durationMin: 5,
      status: 'published',
      youtubeId: '7CwciY0fwHo',
      module: 'Getting Started',
      preview: {
        intro:
          'Define what makes an agent different from a basic chat experience, introduce Mastra and the kinds of AI-powered apps you can build with it, and preview the Theme Park Companion Agent you will build throughout the course.',
        bullets: [
          'What makes an agent different from a chatbot',
          'The core Mastra building blocks: agents, tools, workflows, memory, retrieval, observability',
          'Flyover demo of the finished agent running in Studio',
        ],
      },
      seo: {
        title: 'Build AI Agents with Mastra | Mastra 101',
        description:
          'Learn what AI agents are, how they differ from chatbots, and preview the Theme Park Companion Agent you will build with Mastra.',
      },
    },
    {
      slug: '02-setup-and-first-run',
      title: 'Mastra Setup and First Run',
      durationMin: 5.5,
      status: 'published',
      youtubeId: 'KlBzeoU33iU',
      module: 'Getting Started',
      preview: {
        intro:
          'Cover the main ways people start with Mastra, scaffold a project, and open Mastra Studio — the interactive UI for building and testing agents locally.',
        bullets: [
          'Three starting paths: integrate, scaffold with create-mastra, or start from a template',
          'Create and run a Mastra project locally',
          'Navigate Studio: Agents, Workflows, Tools, and Traces',
        ],
      },
      seo: {
        title: 'Setup and First Run in Mastra Studio | Mastra 101',
        description:
          'Scaffold a Mastra project, run it locally, and explore Mastra Studio — the interactive UI for building and testing agents.',
      },
    },
    {
      slug: '03-mastra-project-structure',
      title: 'Mastra Project Structure',
      durationMin: 4.5,
      status: 'published',
      youtubeId: 'lDKFFWLmt1Q',
      module: 'Getting Started',
      preview: {
        intro:
          'Connect what you see in Studio to the project layout created by create-mastra. Use the scaffolded Weather agent, workflow, and tool as your reference point.',
        bullets: [
          'Project structure: src/mastra/agents, tools, workflows, and index.ts',
          'What the Mastra instance is and why index.ts is the entry point',
          'Map Studio sections to the source folders you will edit next',
        ],
      },
      seo: {
        title: 'Mastra Project Structure | Mastra 101',
        description:
          'Understand the Mastra project structure — agents, tools, workflows, config, and how Studio maps to your source files.',
      },
    },
    {
      slug: '04-create-a-new-agent',
      title: 'Create a New Agent',
      durationMin: 5.3,
      status: 'published',
      youtubeId: 'lwhJxPl_loQ',
      module: 'Getting Started',
      preview: {
        intro:
          'Build your own agent from scratch in code, register it in the Mastra setup, and confirm it appears in Studio. This becomes the agent you keep extending for the rest of the course.',
        bullets: [
          'Create an agent file with name, instructions, and model',
          'Register the agent in src/mastra/index.ts',
          'First look at a trace: "This is where we will debug everything"',
        ],
      },
      seo: {
        title: 'Create a New Agent | Mastra 101',
        description:
          'Build a custom AI agent with instructions and model config, register it in Mastra, and run it in Studio.',
      },
    },

    // Module 2: Tools
    {
      slug: '05-create-a-tool',
      title: 'Create a Tool',
      durationMin: 7,
      status: 'published',
      youtubeId: 'P8voCXTIGVI',
      module: 'Tools',
      preview: {
        intro:
          'Create one simple tool, test it in Studio in isolation, attach it to your agent, and prompt the agent so it calls the tool. Then open Traces and see the tool call and result.',
        bullets: [
          'A tool is a function the agent can call — with inputs, outputs, and a description',
          'Test the tool in Studio before the agent uses it',
          'Show the tool call input/output in the trace',
        ],
      },
    },
    {
      slug: '06-build-with-ai',
      title: 'Build with AI',
      durationMin: 3.5,
      status: 'published',
      youtubeId: 'AXdVW5chxiA',
      module: 'Tools',
      preview: {
        intro:
          'Quick aside: if you are using Cursor, Windsurf, Claude Code, VS Code, or Codex — anything that supports MCP — Mastra has an MCP Docs Server worth turning on.',
        bullets: [
          'What the Mastra MCP Docs Server is',
          'How to enable it in your editor',
          'Get contextual Mastra docs while you code',
        ],
      },
    },
    {
      slug: '07-fetch-live-data',
      title: 'Fetch Live Data with Tools',
      durationMin: 7.5,
      status: 'published',
      youtubeId: 'CMofx-DhpoY',
      module: 'Tools',
      preview: {
        intro:
          'Create a second tool that fetches live wait times from the parkId returned by your first tool call. Show how tools compose naturally when the agent chains them.',
        bullets: [
          'Build a tool that calls an external API for live data',
          'Let the agent chain multiple tool calls in a single conversation',
          'Verify the full chain in Studio traces',
        ],
      },
    },
    {
      slug: '08-connect-agents-to-mcp-servers',
      title: 'Connect Agents to MCP Servers',
      durationMin: 7.5,
      status: 'published',
      youtubeId: 'b8rNHmL4s2s',
      module: 'Tools',
      preview: {
        intro:
          'Connect your agent to external MCP servers to access tools from the MCP ecosystem. Show how Mastra bridges agent capabilities with the Model Context Protocol.',
        bullets: [
          'What MCP servers are and how they expose tools',
          'Configure MCP server connections in your Mastra project',
          'Use MCP-provided tools alongside your custom tools',
        ],
      },
    },

    // Module 3: Workflows
    {
      slug: '09-build-a-workflow',
      title: 'Build a Workflow',
      durationMin: 5,
      status: 'comingSoon',
      module: 'Workflows',
      preview: {
        intro:
          'The agent can call a single tool, but some tasks need a repeatable multi-step sequence. Build a workflow, chain multiple steps, and run it in Studio.',
        bullets: [
          'When a workflow is the right move: multi-step, fixed order',
          'createStep() and createWorkflow() basics',
          'Step input and output: data flows between steps',
        ],
      },
    },
    {
      slug: '10-agents-vs-workflows',
      title: 'Agents vs. Workflows',
      durationMin: 3,
      status: 'comingSoon',
      module: 'Workflows',
      preview: {
        intro: 'Before we keep building, get a clear mental model for when to use an agent vs. when to use a workflow.',
        bullets: [
          'Agents: open-ended goal, the model decides the steps and when to stop',
          'Workflows: predefined steps, you control the path and stopping condition',
          'Rule of thumb: agents for flexible planning, workflows for repeatable processes',
        ],
      },
    },
    {
      slug: '11-connect-agents-and-workflows',
      title: 'Connect Agent to a Workflow',
      durationMin: 5,
      status: 'comingSoon',
      module: 'Workflows',
      preview: {
        intro:
          'Make the system usable: the user chats with one main agent, the agent delegates multi-step work to a workflow. Add one Human-in-the-Loop approval step using suspend and resume.',
        bullets: [
          'Trigger a workflow from the agent as a single capability',
          'Add a HITL approval gate with suspend(), resume(), and bail()',
          'Traces show workflow steps, tool calls, and outputs end-to-end',
        ],
      },
    },

    // Module 4: Memory
    {
      slug: '12-why-agents-forget',
      title: 'Why Agents "Forget"',
      durationMin: 4,
      status: 'comingSoon',
      module: 'Memory',
      preview: {
        intro:
          'Show the problem: ask your agent for a plan, then follow up with "do that again but change X." Without memory, each call is stateless. Introduce context engineering and how Mastra memory works.',
        bullets: [
          'Why an LLM is stateless between calls',
          'Context engineering: choosing what context the model gets per call',
          'Thread and resource IDs: what gets stored and retrieved',
        ],
      },
    },
    {
      slug: '13-turn-on-memory',
      title: 'Turn On Memory',
      durationMin: 5,
      status: 'comingSoon',
      module: 'Memory',
      preview: {
        intro:
          'Enable memory on your agent and make semantic recall visible in Studio. Force older information out of recent history so recall has to retrieve it, then verify in the trace.',
        bullets: [
          'Memory setup: agent configuration plus a storage provider',
          'lastMessages controls recent history; semantic recall retrieves older messages by meaning',
          'The key mental model: the agent retrieved and included context, it did not "remember"',
        ],
      },
    },
    {
      slug: '14-working-memory',
      title: 'Working Memory with a Template, Plus Scope',
      durationMin: 4,
      status: 'comingSoon',
      module: 'Memory',
      preview: {
        intro:
          'Add working memory: a short template that captures stable user facts. Then show one scoping choice — keep working memory per thread or per resource.',
        bullets: [
          'Working memory is "always relevant" info the agent keeps updated over time',
          'Resource scope persists across threads for the same user',
          'Thread scope isolates memory per conversation',
        ],
      },
    },

    // Module 5: Production
    {
      slug: '15-debug-with-traces',
      title: 'Debug with Traces and One Simple Scorer',
      durationMin: 5,
      status: 'comingSoon',
      module: 'Production',
      preview: {
        intro:
          'Use Mastra Studio Traces to see what your agent actually did, then add one lightweight scorer so you can quantify "good vs bad" runs and iterate confidently.',
        bullets: [
          'Read a trace: inputs, tool calls, retrieved memory, and outputs',
          'Spot the most common failure causes: missing context, wrong tool, weak prompt',
          'Add a custom scorer: preprocess, analyze, generateScore, generateReason',
        ],
      },
    },
    {
      slug: '16-basic-rag',
      title: 'Basic RAG: Add a Knowledge Base',
      durationMin: 5,
      status: 'comingSoon',
      module: 'Production',
      preview: {
        intro:
          'Add a small, curated knowledge base to your project, enable retrieval, and verify in Studio that the agent pulls relevant chunks into context before responding.',
        bullets: [
          'When to use a knowledge base: policies, product docs, FAQs, specs',
          'The RAG pipeline: chunking, embeddings, vector store, retrieval at query time',
          'Retrieved chunks show up in the trace for verification',
        ],
      },
    },
    {
      slug: '17-add-voice',
      title: 'Add Voice to an Agent: STT/TTS',
      durationMin: 4,
      status: 'comingSoon',
      module: 'Production',
      preview: {
        intro:
          'Introduce where voice fits in an agent system. Demo TTS so the agent speaks its response, explain STT, and make it clear voice is just another interface layer on the same agent.',
        bullets: [
          'Mastra voice: a unified interface for TTS, STT, and realtime STS',
          'Adding voice enables .voice.speak() / .voice.listen() style flows',
          'Provider swap (OpenAI, ElevenLabs, etc.) — the pattern stays the same',
        ],
      },
    },
    {
      slug: '18-deployment-and-next-steps',
      title: 'Deployment and Next Steps',
      durationMin: 4,
      status: 'comingSoon',
      module: 'Production',
      preview: {
        intro:
          'What changes when you move from Studio to production, and how to call your agent from an app via HTTP or SDK.',
        bullets: [
          'Runtime choices: Node, Bun, Deno, Cloudflare-style environments',
          'Mastra becomes an HTTP server with API endpoints and streaming',
          'Frontend integration with AI SDK UI, CopilotKit, or Assistant UI',
        ],
      },
    },
  ],
}
