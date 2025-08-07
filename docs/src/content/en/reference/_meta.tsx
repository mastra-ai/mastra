import { Meta } from "nextra";
import { Tag } from "@/components/tag";

const meta: Meta = {
  index: {
    title: "Overview",
  },
  core: "Core",
  cli: "CLI",
  templates: "Templates",
  agents: "Agents",
  tools: "Tools",
  workflows: "Workflows",
  legacyWorkflows: {
    title: "Legacy Workflows",
    display: "hidden",
  },
  networks: "Networks",
  auth: <Tag text="experimental">Auth</Tag>,
  memory: "Memory",
  storage: "Storage",
  rag: "RAG",
  evals: "Evals",
  scorers: <Tag text="experimental">Scorers</Tag>,
  voice: "Voice",
  observability: "Observability",
  "client-js": "Client SDK",
  deployer: "Deployer",
};

export default meta;
