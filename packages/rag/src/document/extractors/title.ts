import type { MastraLanguageModel } from '@mastra/core/agent';

export interface ChunkLike {
  text: string;
  metadata?: Record<string, any>;
}

export interface TitleExtractOptions {
  llm: MastraLanguageModel;
  promptTemplate?: string; // must include {context}
}

export interface TitleResult {
  title: string;
  chunkIndex: number;
}

export class TitleExtractor {
  private llm: MastraLanguageModel;
  private promptTemplate: string;

  constructor(options: TitleExtractOptions) {
    this.llm = options.llm;
    this.promptTemplate = options.promptTemplate ?? 'Provide a concise title for the following content:\n{context}';
  }

  async run(chunks: ChunkLike[]): Promise<TitleResult[]> {
    const results: TitleResult[] = [];
    for (let i = 0; i < chunks.length; ++i) {
      const chunk = chunks[i];
      if (!chunk?.text) continue;
      const prompt = this.promptTemplate.replace('{context}', chunk.text);
      const result = await this.llm.doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      });
      let title = '';
      if (typeof result === 'string') {
        title = (result as string).trim();
      } else if (result && typeof result === 'object' && 'text' in result && typeof (result as any).text === 'string') {
        title = (result as any).text.trim();
      }
      results.push({ title, chunkIndex: i });
    }
    return results;
  }
}
