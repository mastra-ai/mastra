import { Memory } from '@mastra/memory';

// Default-exported `Memory` instance is wired in as the agent's `memory`.
// `config.memory` in config.ts would win over this file if both were set.
export default new Memory();
