import type { Processor, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Knowledge } from '../knowledge';

/**
 * Options for the StaticKnowledge processor
 */
export interface StaticKnowledgeOptions {
  /** Knowledge instance to fetch static artifacts from */
  knowledge: Knowledge;
  /**
   * How to format the knowledge in the system message
   * @default 'xml'
   */
  format?: 'xml' | 'markdown' | 'plain';
  /**
   * Custom formatter function for the knowledge content
   * If provided, overrides the format option
   */
  formatter?: (artifacts: Array<{ key: string; content: string }>) => string;
}

/**
 * StaticKnowledge is an input processor that fetches artifacts from the
 * static/ directory in Knowledge and adds them to system messages.
 *
 * Use this for "world knowledge" - facts, rules, domain models that should
 * always be available to the agent.
 *
 * @example
 * ```typescript
 * const knowledge = new Knowledge({
 *   storage: new FilesystemStorage({ namespace: './knowledge' }),
 * });
 *
 * // Add static artifacts
 * await knowledge.add({
 *   type: 'text',
 *   key: 'static/refund-policy.txt',
 *   content: 'All refunds must be processed within 30 days.',
 * });
 *
 * const processor = new StaticKnowledge({
 *   knowledge,
 *   format: 'xml'
 * });
 *
 * const agent = new Agent({
 *   processors: [processor],
 *   // ...
 * });
 * ```
 */
export class StaticKnowledge implements Processor {
  readonly id = 'static-knowledge';
  readonly name = 'StaticKnowledge';

  private knowledge: Knowledge;
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (artifacts: Array<{ key: string; content: string }>) => string;

  constructor(options: StaticKnowledgeOptions) {
    this.knowledge = options.knowledge;
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
  }

  /**
   * Process input by fetching static knowledge and adding to system messages
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messages, messageList } = args;

    // Fetch static artifacts from knowledge
    const artifacts = await this.knowledge.getStatic();

    if (artifacts.length === 0) {
      return messageList;
    }

    // Format the knowledge content
    const knowledgeContent = this.formatKnowledge(artifacts);

    // Add as system message
    messageList.addSystem({
      role: 'system',
      content: knowledgeContent,
    });

    return messageList;
  }

  /**
   * Format knowledge artifacts based on the configured format
   */
  private formatKnowledge(artifacts: Array<{ key: string; content: string }>): string {
    // Use custom formatter if provided
    if (this.formatter) {
      return this.formatter(artifacts);
    }

    switch (this.format) {
      case 'xml':
        return this.formatAsXml(artifacts);
      case 'markdown':
        return this.formatAsMarkdown(artifacts);
      case 'plain':
      default:
        return this.formatAsPlain(artifacts);
    }
  }

  /**
   * Format knowledge as XML
   */
  private formatAsXml(artifacts: Array<{ key: string; content: string }>): string {
    const itemsXml = artifacts
      .map(artifact => {
        return `  <knowledge key="${artifact.key}">\n    ${artifact.content}\n  </knowledge>`;
      })
      .join('\n');

    return `<static_knowledge>\n${itemsXml}\n</static_knowledge>`;
  }

  /**
   * Format knowledge as Markdown
   */
  private formatAsMarkdown(artifacts: Array<{ key: string; content: string }>): string {
    const itemsMd = artifacts
      .map(artifact => {
        return `## ${artifact.key}\n\n${artifact.content}`;
      })
      .join('\n\n---\n\n');

    return `# Knowledge Base\n\n${itemsMd}`;
  }

  /**
   * Format knowledge as plain text
   */
  private formatAsPlain(artifacts: Array<{ key: string; content: string }>): string {
    return artifacts
      .map(artifact => {
        return `[${artifact.key}]:\n${artifact.content}`;
      })
      .join('\n\n');
  }
}
