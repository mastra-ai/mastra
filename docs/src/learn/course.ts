import type { Course } from './types'

export const course: Course = {
  courseId: 'mastra-101',
  title: 'Build Your First AI Agent in TypeScript',
  description: `This course is your roadmap to becoming an AI Engineer.

In 90 minutes, you'll build and deploy your first agent in TypeScript with Mastra. Along the way, you'll learn how the agent loop works under the hood, how tools let an agent reach into other systems, how MCP opens the door to external resources, and how context engineering and memory shape behavior across a conversation.                

By the end, you'll have shipped your first agent - and more importantly, you'll know how to build the next one on your own. The patterns you implement here carry directly into whatever you choose to build next.                                                                              

AI agents are the next platform shift. Understanding how to build them is now a core skill for engineers, and there's real opportunity for those who get there early. If you're excited about what's possible and want a clear, practical path to get there, this course is for you.`,
  lessons: [
    // Module 1: Getting Started
    {
      slug: 'what-is-an-agent',
      title: 'What is an Agent?',
      durationMin: 5,
      status: 'published',
      youtubeId: 'G8tXjcseNjg',
      publishedDate: '2026-03-04T00:00:00Z',
      module: 'Agents',
      preview: {
        intro:
          'Define what makes an agent different from a basic chat experience, introduce Mastra and the kinds of AI-powered apps you can build with it in TypeScript, and preview the Theme Park Companion Agent you will build throughout the course.',
        bullets: [
          'What makes an agent different from a chatbot',
          'The core Mastra building blocks: agents, tools, workflows, memory, retrieval, observability',
          'Flyover demo of the finished agent running in Studio',
        ],
      },
      seo: {
        title: 'What is an Agent? | Mastra',
        description:
          'Learn what AI agents are, how they differ from chatbots, and preview the Theme Park Companion Agent you will build with Mastra.',
      },
    },
    {
      slug: 'run-your-first-agent',
      title: 'Run Your First Agent',
      durationMin: 5,
      status: 'published',
      youtubeId: 'RaqlPrGBscw',
      publishedDate: '2026-03-04T00:00:00Z',
      module: 'Agents',
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
        title: 'Run Your First Agent | Mastra',
        description:
          'Scaffold a Mastra project, run it locally, and explore Mastra Studio — the interactive UI for building and testing agents.',
      },
    },
    {
      slug: 'project-structure',
      title: 'Project Structure',
      durationMin: 4,
      status: 'published',
      youtubeId: 'lDKFFWLmt1Q',
      publishedDate: '2026-03-04T00:00:00Z',
      module: 'Agents',
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
        title: 'Project Structure | Mastra',
        description:
          'Understand the Mastra project structure — agents, tools, workflows, config, and how Studio maps to your source files.',
      },
    },
    {
      slug: 'create-an-agent',
      title: 'Create an Agent',
      durationMin: 5,
      status: 'published',
      youtubeId: 'lwhJxPl_loQ',
      publishedDate: '2026-03-04T00:00:00Z',
      module: 'Agents',
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
        title: 'Create an Agent | Mastra',
        description:
          'Build a custom AI agent with instructions and model config, register it in Mastra, and run it in Studio.',
      },
    },

    // Module 2: Tools
    {
      slug: 'create-a-tool',
      title: 'Create a Tool',
      durationMin: 7,
      status: 'published',
      youtubeId: 'P8voCXTIGVI',
      publishedDate: '2026-03-04T00:00:00Z',
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
      slug: 'build-with-ai',
      title: 'Build with AI',
      durationMin: 3,
      status: 'published',
      youtubeId: 'PBtct9tG19k',
      publishedDate: '2026-03-04T00:00:00Z',
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
      slug: 'fetch-live-data',
      title: 'Fetch Live Data',
      durationMin: 7,
      status: 'published',
      youtubeId: 'CMofx-DhpoY',
      publishedDate: '2026-03-04T00:00:00Z',
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
      slug: 'connect-to-mcp',
      title: 'Connect to MCP',
      durationMin: 7,
      status: 'published',
      youtubeId: 'b8rNHmL4s2s',
      publishedDate: '2026-03-04T00:00:00Z',
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
      slug: 'build-a-workflow',
      title: 'Build a Workflow',
      durationMin: 7.5,
      youtubeId: 'Xu0N43frgMs',
      status: 'published',
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
      slug: 'agents-vs-workflows',
      title: 'Agents vs. Workflows',
      durationMin: 3,
      youtubeId: 'kiFhVZyHG84',
      status: 'published',
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
      slug: 'agents-in-workflows',
      title: 'Agents in Workflows',
      durationMin: 9,
      youtubeId: 'hHtUcuDqFrY',
      status: 'published',
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
      slug: 'how-memory-works',
      title: 'How Memory Works',
      durationMin: 5.5,
      youtubeId: 'RvtDJJhI8FE',
      status: 'published',
      module: 'Memory',
      preview: {
        intro:
          'The model is stateless between calls. Memory is what lets follow-ups work. Trace a real conversation in Studio to see exactly what context the agent received, and learn the lastMessages setting that controls how much history gets included per call.',
        bullets: [
          'Why the model is stateless and what Mastra does about it',
          'Context engineering: deciding what the model gets to see per call',
          'lastMessages: the setting that controls recent history in the context window',
        ],
      },
    },
    {
      slug: 'observational-memory',
      title: 'Observational Memory',
      durationMin: 5,
      youtubeId: 'x2UQ7zIdrbI',
      status: 'published',
      module: 'Memory',
      preview: {
        intro:
          'Raw message history piles up fast. Enable Observational Memory to automatically compress older context into denser observations, then test resource-scoped memory so preferences carry across threads for the same user.',
        bullets: [
          'OM compresses older history via Observer and Reflector background agents',
          'Resource scope: memory follows the user across threads, not just within one conversation',
          'OM replaces manual lastMessages tuning with automatic context management',
        ],
      },
    },
    {
      slug: 'guardrails-with-processors',
      title: 'Guardrails with Processors',
      durationMin: 5,
      youtubeId: '9XHVGLld8kk',
      status: 'published',
      module: 'Memory',
      preview: {
        intro:
          'Once real users are involved, you need input guardrails. Add PromptInjectionDetector and ModerationProcessor to block hostile requests before the model ever sees them.',
        bullets: [
          'Processors intercept messages before the model call and after the response',
          'PromptInjectionDetector: blocks injection, jailbreak, and system override attempts',
          'ModerationProcessor: screens incoming messages for hate and harassment',
        ],
      },
    },

    // Module 5: Production
    {
      slug: 'deploy-to-mastra-platform',
      title: 'Deploy to Mastra Platform',
      durationMin: 4,
      youtubeId: 'O1FnS_qrsPs',
      status: 'published',
      module: 'Production',
      preview: {
        intro:
          'Deploy the Theme Park agent from your local Studio environment to a live public endpoint using Mastra Server.',
        bullets: [
          'Explore the Swagger UI to see every agent already exposed as HTTP endpoints',
          'Run mastra server deploy to build, upload, and get a stable public URL',
          'Mastra is already an HTTP server — Mastra Server puts it somewhere public',
        ],
      },
    },
    {
      slug: 'chat-with-agent-in-slack',
      title: 'Chat With Agent in Slack',
      durationMin: 9,
      youtubeId: 'fD6M6n_OdJI',
      status: 'published',
      module: 'Production',
      preview: {
        intro:
          'Connect the deployed Theme Park agent to Slack so you can message it from anywhere — same tools, memory, and workflows, from a DM.',
        bullets: [
          'Add the Slack adapter and a channels config to the agent',
          'Mastra exposes the webhook route automatically — no handler to write',
          'Channels also supports Discord and Telegram through the same pattern',
        ],
      },
    },
  ],
}
