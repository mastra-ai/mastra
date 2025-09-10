import { Tag } from "@/components/tag";

const meta = {
  agent: "Agent",
  generate: ".generate()",
  stream: ".stream()",
  streamVNext: <Tag text="experimental">.streamVNext()</Tag>,
  MastraModelOutput: "MastraModelOutput",
  ChunkType: "ChunkType",
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
