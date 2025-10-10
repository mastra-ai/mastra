import { Tag } from "@/components/tag";

const meta = {
  agent: "Agent",
  generate: ".generate()",
  generateLegacy: ".generateLegacy() (Legacy)",
  network: <Tag text="experimental">.network()</Tag>,
  listAgents: ".listAgents()",
  getWorkflows: ".getWorkflows()",
  getTools: ".getTools()",
  getScorers: ".getScorers()",
  getModel: ".getModel()",
  getMemory: ".getMemory()",
  getVoice: ".getVoice()",
  getDescription: ".getDescription()",
  getInstructions: ".getInstructions()",
  getLLM: ".getLLM()",
  getDefaultGenerateOptions: ".getDefaultGenerateOptions()",
  getDefaultStreamOptions: ".getDefaultStreamOptions()",
};

export default meta;
