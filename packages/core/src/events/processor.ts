import type { Mastra } from '../mastra';
import type { Event } from './types';

export abstract class EventProcessor {
  protected mastra: Mastra;

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
  }

  constructor({ mastra }: { mastra: Mastra }) {
    this.mastra = mastra;
  }

  protected abstract process(event: Event): Promise<void>;
}
