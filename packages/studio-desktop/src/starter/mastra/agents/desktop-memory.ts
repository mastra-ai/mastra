import { Memory } from '@mastra/memory';

const DESKTOP_AGENT_MEMORY_OPTIONS = {
  lastMessages: 20,
  semanticRecall: false,
} as const;

export function createDesktopAgentMemory(id: string) {
  return new Memory({
    id: `${id}-memory`,
    name: `${id} memory`,
    options: DESKTOP_AGENT_MEMORY_OPTIONS,
  });
}
