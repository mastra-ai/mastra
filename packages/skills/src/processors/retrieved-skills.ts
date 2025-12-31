import type { MastraSkills, SkillSearchResult, SkillSearchOptions } from '@mastra/core/skills';
import { BaseProcessor } from '@mastra/core/processors';
import type { ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Skills } from '../skills';

/**
 * Options for the RetrievedSkills processor
 */
export interface RetrievedSkillsOptions {
  /**
   * Skills source - either:
   * - A Skills instance to search directly
   * - Omit to inherit from Mastra at runtime (requires agent to be registered with Mastra)
   */
  skills?: Skills | MastraSkills;
  /**
   * Maximum number of results to retrieve (default: 3)
   */
  topK?: number;
  /**
   * Minimum score threshold
   * Results below this score are filtered out
   */
  minScore?: number;
  /**
   * Only search within specific skill names
   */
  skillNames?: string[];
  /**
   * Include reference files in search (default: true)
   */
  includeReferences?: boolean;
  /**
   * How to format the retrieved skills in the system message
   * @default 'xml'
   */
  format?: 'xml' | 'markdown' | 'plain';
  /**
   * Custom formatter function for the retrieved content
   * If provided, overrides the format option
   */
  formatter?: (results: SkillSearchResult[]) => string;
  /**
   * Function to extract the search query from the user's message
   * By default, uses the last user message text
   */
  queryExtractor?: (args: ProcessInputArgs) => string | undefined;
}

/**
 * RetrievedSkills is an input processor that searches skills
 * based on the user's query and adds relevant results to the context.
 *
 * Use this for large skill collections where you can't inject everything into
 * the system prompt - instead, search for relevant skill content using BM25.
 *
 * @example
 * ```typescript
 * const skills = new Skills({
 *   id: 'my-skills',
 *   paths: './skills',
 * });
 *
 * const processor = new RetrievedSkills({
 *   skills,
 *   topK: 3,
 *   minScore: 0.5,
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [processor],
 *   // ...
 * });
 *
 * // User asks: "How do I process PDFs?"
 * // -> Processor searches skills, finds relevant content, injects into context
 * ```
 */
export class RetrievedSkills extends BaseProcessor<'retrieved-skills'> {
  readonly id = 'retrieved-skills' as const;
  readonly name = 'RetrievedSkills';

  private skills?: Skills | MastraSkills;
  private topK: number;
  private minScore?: number;
  private skillNames?: string[];
  private includeReferences: boolean;
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (results: SkillSearchResult[]) => string;
  private queryExtractor: (args: ProcessInputArgs) => string | undefined;

  constructor(options: RetrievedSkillsOptions = {}) {
    super();
    this.skills = options.skills;
    this.topK = options.topK ?? 3;
    this.minScore = options.minScore;
    this.skillNames = options.skillNames;
    this.includeReferences = options.includeReferences ?? true;
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
    this.queryExtractor = options.queryExtractor ?? this.defaultQueryExtractor;
  }

  /**
   * Get the skills instance.
   * If skills was not provided, attempts to inherit from the registered Mastra instance.
   * @throws Error if skills cannot be resolved
   */
  private getSkillsInstance(): Skills | MastraSkills {
    // If skills was provided directly, use it
    if (this.skills) {
      return this.skills;
    }

    // Try to inherit from the registered Mastra instance
    if (this.mastra?.getSkills) {
      const inherited = this.mastra.getSkills();
      if (inherited) {
        return inherited;
      }
    }

    throw new Error(
      'No skills instance available. Either pass a skills instance to the processor, ' +
        'or register a skills instance with Mastra.',
    );
  }

  /**
   * Default query extractor - gets the last user message text
   */
  private defaultQueryExtractor(args: ProcessInputArgs): string | undefined {
    const { messages } = args;

    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === 'user') {
        // Extract text content from different formats
        const content = msg.content;

        // Handle string content
        if (typeof content === 'string') {
          return content;
        }

        // Handle array content (AI SDK format)
        if (Array.isArray(content)) {
          const textParts = content
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text);
          if (textParts.length > 0) {
            return textParts.join(' ');
          }
        }

        // Handle MastraDBMessage format (content.parts)
        if (content && typeof content === 'object' && 'parts' in content && Array.isArray(content.parts)) {
          const textParts = content.parts
            .filter(
              (part: { type: string; text?: string }): part is { type: 'text'; text: string } => part.type === 'text',
            )
            .map((part: { type: 'text'; text: string }) => part.text);
          if (textParts.length > 0) {
            return textParts.join(' ');
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Process input by searching skills and adding relevant results
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList } = args;

    // Extract the search query
    const query = this.queryExtractor(args);
    if (!query) {
      // No query to search with, return unchanged
      return messageList;
    }

    // Get the skills instance (from options or inherited from Mastra)
    const skills = this.getSkillsInstance();

    // Build search options
    const searchOptions: SkillSearchOptions = {
      topK: this.topK,
      minScore: this.minScore,
      skillNames: this.skillNames,
      includeReferences: this.includeReferences,
    };

    // Search skills
    const results = skills.search(query, searchOptions);

    if (results.length === 0) {
      // No results found, return unchanged
      return messageList;
    }

    // Format the retrieved skills
    const skillsContent = this.formatResults(results);

    // Add as system message
    messageList.addSystem({
      role: 'system',
      content: skillsContent,
    });

    return messageList;
  }

  /**
   * Format search results based on the configured format
   */
  private formatResults(results: SkillSearchResult[]): string {
    // Use custom formatter if provided
    if (this.formatter) {
      return this.formatter(results);
    }

    switch (this.format) {
      case 'xml':
        return this.formatAsXml(results);
      case 'markdown':
        return this.formatAsMarkdown(results);
      case 'plain':
      default:
        return this.formatAsPlain(results);
    }
  }

  /**
   * Format results as XML
   */
  private formatAsXml(results: SkillSearchResult[]): string {
    const itemsXml = results
      .map(result => {
        const scoreAttr = ` score="${result.score.toFixed(3)}"`;
        return `  <skill name="${this.escapeXml(result.skillName)}" source="${this.escapeXml(result.source)}"${scoreAttr}>\n    ${result.content}\n  </skill>`;
      })
      .join('\n');

    return `<retrieved_skills>\n${itemsXml}\n</retrieved_skills>`;
  }

  /**
   * Format results as Markdown
   */
  private formatAsMarkdown(results: SkillSearchResult[]): string {
    const itemsMd = results
      .map(result => {
        return `## ${result.skillName} (${result.source})\n*Relevance: ${(result.score * 100).toFixed(1)}%*\n\n${result.content}`;
      })
      .join('\n\n---\n\n');

    return `# Retrieved Skills\n\n${itemsMd}`;
  }

  /**
   * Format results as plain text
   */
  private formatAsPlain(results: SkillSearchResult[]): string {
    return results
      .map(result => {
        return `[${result.skillName}:${result.source}] (score: ${result.score.toFixed(3)}):\n${result.content}`;
      })
      .join('\n\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
