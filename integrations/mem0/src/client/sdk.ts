import type { Message, MemoryOptions, SearchOptions } from 'mem0ai';
import Mem0Client from 'mem0ai';
import type { Mem0Config } from '../types';
import { Mem0Utils } from './utils';

export class Mem0AIClient {
  private client: Mem0Client;
  private mem0Config: Mem0Config;

  constructor(config: Mem0Config) {
    const snakeCaseConfig = Object.fromEntries(
      Object.entries(config).map(([key, value]) => [Mem0Utils.convertCamelCaseToSnakeCase(key), value])
    ) as Mem0Config;
    this.mem0Config = snakeCaseConfig;
    this.client = new Mem0Client(snakeCaseConfig);
  }

  async createMemory(messages: Message[] | string, options?: MemoryOptions) {
    const messagesToAdd = typeof messages === 'string' ? Mem0Utils.convertStringToMessages(messages) : messages;
    const memory = await this.client.add(messagesToAdd, {
      ...this.mem0Config,
      ...options,
    });

    const memoryString = Mem0Utils.getMemoryString(memory);
    
    return memoryString;
  }

  async searchMemory(query: string, options?: SearchOptions) {
    const memory = await this.client.search(query, {
      ...this.mem0Config,
      ...options,
    });

    const memoryString = Mem0Utils.getMemoryString(memory);

    return memoryString;
  }
  
}
