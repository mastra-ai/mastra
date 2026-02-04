import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { MastraCompositeStore } from '../storage';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';

export type MastraPrimitives = {
  logger?: IMastraLogger;
  storage?: MastraCompositeStore;
  agents?: Record<string, Agent>;
  tts?: Record<string, MastraTTS>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
};

export type MastraUnion = {
  [K in keyof Mastra]: Mastra[K];
} & MastraPrimitives;
