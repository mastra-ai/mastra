import { writeFile } from 'fs/promises';
import { MemoryProcessor } from '@mastra/core';
import type { CoreMessage } from '@mastra/core';

export class WriteToDiskProcessor extends MemoryProcessor {
  private prefix: string;

  constructor({ prefix = 'messages' }: { prefix?: string } = {}) {
    super({ name: 'WriteToDiskProcessor' });
    this.prefix = prefix;
  }

  async process(messages: CoreMessage[]): Promise<CoreMessage[]> {
    await writeFile(`${this.prefix}-${Date.now()}-${process.pid}.json`, JSON.stringify(messages, null, 2));
    return messages;
  }
}
