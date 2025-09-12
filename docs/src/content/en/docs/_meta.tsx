import { Tag } from "@/components/tag";

const meta = {
  index: "Introduction",
  "getting-started": { title: "Getting Started" },
  agents: { title: "Agents" },
  workflows: { title: "Workflows" },
  "workflows-legacy": {
    title: "Workflows (Legacy)",
    theme: { collapsed: true },
    display: "hidden",
  },
  streaming: <Tag text="experimental">Streaming</Tag>,
  "tools-mcp": { title: "Tools & MCP", theme: { collapsed: true } },
  memory: { title: "Memory", theme: { collapsed: true } },
  "networks-vnext": <Tag text="experimental">Networks</Tag>,
  rag: { title: "RAG" },
  "server-db": {
    title: "Server & DB",
  },
  deployment: { title: "Deployment" },
  "mastra-cloud": { title: "Mastra Cloud" },
  observability: { title: "Observability" },
  evals: { title: "Evals" },
  scorers: <Tag text="experimental">Scorers</Tag>,
  auth: <Tag text="experimental">Auth</Tag>,
  voice: { title: "Voice" },
  frameworks: { title: "Frameworks" },
  community: "Community",
};

export default meta;
