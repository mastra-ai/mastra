import { Tag } from "@/components/tag";

const meta = {
  index: "Introduction",
  "getting-started": { title: "Getting Started", theme: { collapsed: false } },
  agents: { title: "Agents" },
  workflows: { title: "Workflows" },
  "workflows-legacy": {
    title: "Workflows (Legacy)",
    theme: { collapsed: true },
    display: "hidden",
  },
  streaming: { title: "Streaming" },
  "tools-mcp": { title: "Tools & MCP" },
  memory: { title: "Memory" },
  rag: { title: "RAG" },
  "server-db": {
    title: "Server & DB",
  },
  deployment: { title: "Deployment" },
  observability: { title: "Observability" },
  scorers: <Tag text="experimental">Scorers</Tag>,
  auth: <Tag text="experimental">Auth</Tag>,
  voice: { title: "Voice" },
  frameworks: { title: "Frameworks" },
  community: "Community",
};

export default meta;
