import { readFile } from 'node:fs/promises';
import type { AgentCase, FileDatasetConfig } from '../types';
import { agentCaseSchema } from '../types';
import { BaseDatasetSource } from './dataset-source';

/**
 * Dataset source from a JSONL or JSON file.
 */
export class FileSource extends BaseDatasetSource {
  private path: string;
  private format: 'jsonl' | 'json';
  private cachedCases?: AgentCase[];

  constructor(path: string, format: 'jsonl' | 'json' = 'jsonl') {
    super();
    this.path = path;
    this.format = format;
  }

  async *streamCases(): AsyncIterable<AgentCase> {
    const cases = await this.loadCases();
    for (const case_ of cases) {
      yield case_;
    }
  }

  async getCases(): Promise<AgentCase[]> {
    return this.loadCases();
  }

  async getCount(): Promise<number> {
    const cases = await this.loadCases();
    return cases.length;
  }

  private async loadCases(): Promise<AgentCase[]> {
    if (this.cachedCases) {
      return this.cachedCases;
    }

    const content = await readFile(this.path, 'utf-8');

    if (this.format === 'json') {
      const data = JSON.parse(content);
      const cases = Array.isArray(data) ? data : [data];
      this.cachedCases = cases.map((c, i) => this.parseCase(c, i));
    } else {
      // JSONL format
      const lines = content.split('\n').filter(line => line.trim());
      this.cachedCases = lines.map((line, i) => {
        const data = JSON.parse(line);
        return this.parseCase(data, i);
      });
    }

    return this.cachedCases;
  }

  private parseCase(data: unknown, index: number): AgentCase {
    // Try to parse with schema validation
    const parsed = agentCaseSchema.safeParse(data);
    if (parsed.success) {
      return parsed.data;
    }

    // Fallback: try to construct a valid case
    const obj = data as Record<string, unknown>;
    return {
      id: (obj.id as string) || `case-${index}`,
      messages: this.parseMessages(obj),
      metadata: obj.metadata as Record<string, unknown>,
      groundTruth: obj.groundTruth as string | undefined,
    };
  }

  private parseMessages(obj: Record<string, unknown>): AgentCase['messages'] {
    // Handle various input formats
    if (Array.isArray(obj.messages)) {
      return obj.messages.map(m => ({
        role: m.role || 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
        name: m.name,
      }));
    }

    // Handle prompt/completion format
    if (obj.prompt && obj.completion) {
      return [
        { role: 'user', content: String(obj.prompt) },
        { role: 'assistant', content: String(obj.completion) },
      ];
    }

    // Handle input/output format
    if (obj.input) {
      const messages: AgentCase['messages'] = [];
      if (typeof obj.input === 'string') {
        messages.push({ role: 'user', content: obj.input });
      }
      if (obj.output && typeof obj.output === 'string') {
        messages.push({ role: 'assistant', content: obj.output });
      }
      return messages;
    }

    return [];
  }
}

/**
 * Create a FileSource from config.
 */
export function createFileSource(config: FileDatasetConfig): FileSource {
  return new FileSource(config.path, config.format);
}
