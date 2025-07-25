export type ChunkType = {
  type: string;
  runId: string;
  from: string;
  payload: Record<string, any>;
};