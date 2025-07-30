import { Tag } from "@/components/tag";

const meta = {
  index: {
    title: "Overview",
  },
  agents: {
    title: "Agents",
  },
  workflows: {
    title: "Workflows",
  },
  workflows_legacy: {
    title: "Workflows (Legacy)",
    display: "hidden",
  },
  rag: {
    title: "RAG",
  },
  memory: {
    title: "Memory",
  },
  evals: {
    title: "Evals",
  },
  scorers: <Tag text="experimental">Scorers</Tag>,
  voice: {
    title: "Voice",
  },
  deployment: {
    title: "Deployment",
  },
};

export default meta;
