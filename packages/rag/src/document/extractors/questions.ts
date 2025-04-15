import type { MastraLanguageModel } from '@mastra/core/agent';

export interface ChunkLike {
  text: string;
  metadata?: Record<string, any>;
}

export interface QuestionsExtractOptions {
  llm: MastraLanguageModel;
  promptTemplate?: string; // must include {context}
}

export interface QuestionsResult {
  questions: string[];
  chunkIndex: number;
}

export class QuestionsAnsweredExtractor {
  private llm: MastraLanguageModel;
  private promptTemplate: string;

  constructor(options: QuestionsExtractOptions) {
    this.llm = options.llm;
    this.promptTemplate =
      options.promptTemplate ?? 'List all questions answered by the following content as a numbered list:\n{context}';
  }

  async run(chunks: ChunkLike[]): Promise<QuestionsResult[]> {
    const results: QuestionsResult[] = [];
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
      let questions: string[] = [];
      if (typeof result === 'string') {
        questions = (result as string)
          .split(/\n|\r/)
          .map(q => q.replace(/^\d+\.?\s*/, '').trim())
          .filter(Boolean);
      } else if (result && typeof result === 'object' && 'text' in result && typeof (result as any).text === 'string') {
        questions = (result as any).text
          .split(/\n|\r/)
          .map((q: string) => q.replace(/^\d+\.?\s*/, '').trim())
          .filter(Boolean);
      }
      results.push({ questions, chunkIndex: i });
    }
    return results;
  }
}
