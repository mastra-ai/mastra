import { Meta } from "nextra";
import { Tag } from "@/components/tag";

const meta: Meta = {
  index: {
    title: "Overview",
  },
  core: "Core",
  cli: "CLI",
  agents: "Agents",
  workflows: "Workflows",
  legacyWorkflows: {
    title: "Legacy Workflows",
    display: "hidden",
  },
  tools: "Tools & MCP",
  memory: "Memory",
  networks: "Networks",
  rag: "RAG",
  storage: "Storage",
  deployer: "Deployer",
  "client-js": "Client SDK",
  auth: <Tag text="experimental">Auth</Tag>,
  observability: "Observability",
  evals: "Evals",
  scorers: <Tag text="experimental">Scorers</Tag>,
  voice: "Voice",
  templates: "Templates",
};

export default meta;
