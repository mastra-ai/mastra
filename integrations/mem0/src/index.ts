import { Integration } from '@mastra/core/integration';
import type { Message, MemoryOptions, SearchOptions } from 'mem0ai';
import { Mem0AIClient } from './client';
import type { Mem0Config } from './types';


export class Mem0Integration extends Integration<void, Mem0AIClient> {
  readonly name = 'MEM0';
  readonly logoUrl = '';
  config: Mem0Config;
  client: Mem0AIClient;
  categories = ['ai', 'memory'];
  description = 'Mem0 is a memory-based AI platform that allows you to store, search, and analyze your data based on the user\'s query.';

  constructor({ config }: { config: Mem0Config }) {
    super();
    this.config = config;
    this.client = new Mem0AIClient(config);
  }

  async createMemory(messages: Message[] | string, options?: MemoryOptions) {
    const memory = await this.client.createMemory(messages, options);
    return memory;
  }

  async searchMemory(query: string, options?: SearchOptions) {
    const memory = await this.client.searchMemory(query, options);
    return memory;
  }
}
