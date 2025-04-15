import type { MastraLanguageModel } from '@mastra/core/agent';

export interface ChunkLike {
  text: string;
  metadata?: Record<string, any>;
}

export interface KeywordExtractOptions {
  llm: MastraLanguageModel;
  promptTemplate?: string; // must include {context}
}

export interface KeywordResult {
  keywords: string[];
  chunkIndex: number;
}

export class KeywordExtractor {
  private llm: MastraLanguageModel;
  private promptTemplate: string;

  constructor(options: KeywordExtractOptions) {
    this.llm = options.llm;
    this.promptTemplate =
      options.promptTemplate ?? 'Extract keywords from the following content as a comma-separated list:\n{context}';
  }

  async run(chunks: ChunkLike[]): Promise<KeywordResult[]> {
    const results: KeywordResult[] = [];
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
      let keywords: string[] = [];
      if (typeof result === 'string') {
        keywords = (result as string)
          .split(',')
          .map(k => k.trim())
          .filter(Boolean);
      } else if (result && typeof result === 'object' && 'text' in result && typeof (result as any).text === 'string') {
        keywords = (result as any).text
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean);
      }
      results.push({ keywords, chunkIndex: i });
    }
    return results;
  }
}
