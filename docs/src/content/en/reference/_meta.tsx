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
  networks: <Tag text="experimental">Networks</Tag>,
  rag: "RAG",
  storage: "Storage",
  deployer: "Deployer",
  "client-js": "Client SDK",
  observability: "Observability",
  evals: "Evals",
  scorers: <Tag text="experimental">Scorers</Tag>,
  auth: <Tag text="experimental">Auth</Tag>,
  voice: "Voice",
  templates: "Templates",
};

export default meta;
