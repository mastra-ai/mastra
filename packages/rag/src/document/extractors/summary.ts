import type { MastraLanguageModel } from '@mastra/core/agent';

export type SummaryType = 'self' | 'prev' | 'next';

export interface SummaryExtractOptions {
  llm: MastraLanguageModel;
  summaries?: SummaryType[]; // default: ['self']
  promptTemplate?: string; // must include {context}
}

export interface ChunkLike {
  text: string;
  metadata?: Record<string, any>;
}

export interface SummaryResult {
  summary: string;
  type: SummaryType;
  chunkIndex: number;
}

/**
 * Summarize an array of chunks using a custom LLM.
 *
 * @param chunks Array of chunk-like objects
 * @param options Summary extraction options
 * @returns Array of summary results
 */
export class SummaryExtractor {
  private llm: MastraLanguageModel;
  private summaries: SummaryType[];
  private promptTemplate: string;

  constructor(options: SummaryExtractOptions) {
    this.llm = options.llm;
    this.summaries = options.summaries ?? ['self'];
    this.promptTemplate = options.promptTemplate ?? 'Summarize the following content:\n{context}';
  }

  /**
   * Run summary extraction over an array of chunks.
   * @param chunks Array of chunk-like objects
   * @returns Array of summary results
   */
  async run(chunks: ChunkLike[]): Promise<SummaryResult[]> {
    const results: SummaryResult[] = [];
    for (let i = 0; i < chunks.length; ++i) {
      for (const summaryType of this.summaries) {
        let context = '';
        if (summaryType === 'self') {
          context = chunks[i].text;
        } else if (summaryType === 'prev' && i > 0) {
          context = chunks[i - 1].text;
        } else if (summaryType === 'next' && i < chunks.length - 1) {
          context = chunks[i + 1].text;
        } else {
          continue; // skip if no context available
        }
        const prompt = this.promptTemplate.replace('{context}', context);
        const summary = await this.llm.doGenerate(prompt);
        results.push({ summary, type: summaryType, chunkIndex: i });
      }
    }
    return results;
  }
}
