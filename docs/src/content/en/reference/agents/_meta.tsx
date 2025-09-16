import { Tag } from "@/components/tag";

const meta = {
  agent: "Agent",
  generate: ".generate()",
  generateVNext: <Tag text="experimental">.generateVNext()</Tag>,
  stream: ".stream()",
  streamVNext: <Tag text="experimental">.streamVNext()</Tag>,
  network: <Tag text="experimental">.network()</Tag>,
  MastraModelOutput: "MastraModelOutput",
  ChunkType: "ChunkType",
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
  getDefaultVNextStreamOptions: ".getDefaultVNextStreamOptions()",
};

export default meta;
