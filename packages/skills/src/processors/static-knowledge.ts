import type { MastraKnowledge } from '@mastra/core/knowledge';
import { BaseProcessor } from '@mastra/core/processors';
import type { ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Knowledge } from '../knowledge';

/**
 * Options for the StaticKnowledge processor
 */
export interface StaticKnowledgeOptions {
  /**
   * Knowledge instance to fetch static artifacts from.
   * If omitted, inherits from Mastra at runtime.
   */
  knowledge?: Knowledge | MastraKnowledge;
  /**
   * Namespace to fetch static artifacts from
   * @default 'default'
   */
  namespace?: string;
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
export class StaticKnowledge extends BaseProcessor<'static-knowledge'> {
  readonly id = 'static-knowledge' as const;
  readonly name = 'StaticKnowledge';

  private knowledge?: Knowledge | MastraKnowledge;
  private namespace: string;
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (artifacts: Array<{ key: string; content: string }>) => string;

  constructor(options: StaticKnowledgeOptions = {}) {
    super();
    this.knowledge = options.knowledge;
    this.namespace = options.namespace ?? 'default';
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
  }

  /**
   * Get the knowledge instance from options or inherited from Mastra
   */
  private getKnowledgeInstance(): Knowledge | MastraKnowledge {
    if (this.knowledge) {
      return this.knowledge;
    }

    // Try to inherit from the registered Mastra instance
    if (this.mastra?.getKnowledge) {
      const inherited = this.mastra.getKnowledge();
      if (inherited) {
        return inherited;
      }
    }

    throw new Error(
      'No knowledge instance available. Either pass a knowledge instance to the processor, ' +
        'or register a knowledge instance with Mastra.',
    );
  }

  /**
   * Process input by fetching static knowledge and adding to system messages.
   * Runs once at the start of generation.
   */
  async processInput({ messageList }: ProcessInputArgs): Promise<ProcessInputResult> {
    // Get the knowledge instance
    const knowledge = this.getKnowledgeInstance();

    // Fetch static artifacts from knowledge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artifacts = await (knowledge as any).getStatic(this.namespace);

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
