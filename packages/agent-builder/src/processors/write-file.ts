import fs from 'fs';
import { MemoryProcessor } from '@mastra/core';
import type { CoreMessage } from '@mastra/core';

export class WriteToDiskProcessor extends MemoryProcessor {
  private prefix: string;

  constructor({ prefix = 'messages' }: { prefix?: string } = {}) {
    super({ name: 'WriteToDiskProcessor' });
    this.prefix = prefix;
  }

  async process(messages: CoreMessage[]): Promise<CoreMessage[]> {
    fs.writeFileSync(`${this.prefix}-${Date.now()}.json`, JSON.stringify(messages, null, 2));
    return messages;
  }
}
