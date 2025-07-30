import { Tag } from "@/components/tag";

const meta = {
  index: "Introduction",
  "getting-started": { title: "Getting Started" },
  agents: { title: "Agents" },
  "tools-mcp": { title: "Tools & MCP", theme: { collapsed: true } },
  memory: { title: "Memory", theme: { collapsed: true } },
  workflows: { title: "Workflows" },
  "workflows-legacy": {
    title: "Workflows (Legacy)",
    theme: { collapsed: true },
    display: "hidden",
  },
  "networks-vnext": { title: "Networks (vNext)" },
  rag: { title: "RAG" },
  "server-db": {
    title: "Server & DB",
  },
  deployment: { title: "Deployment" },
  "mastra-cloud": { title: "Mastra Cloud" },
  auth: <Tag text="experimental">Auth</Tag>,
  observability: { title: "Observability" },
  evals: { title: "Evals" },
  scorers: <Tag text="experimental">Scorers</Tag>,
  frameworks: { title: "Frameworks" },
  voice: { title: "Voice" },
  community: "Community",
};

export default meta;
