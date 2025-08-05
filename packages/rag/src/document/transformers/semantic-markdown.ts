import type { TiktokenModel, TiktokenEncoding, Tiktoken } from 'js-tiktoken';
import { encodingForModel, getEncoding } from 'js-tiktoken';
import { Document } from '../schema';
import type { SemanticMarkdownChunkOptions } from '../types';

import { TextTransformer } from './text';

interface MarkdownNode {
  title: string;
  depth: number;
  content: string;
  length: number; // Token count
  startIndex?: number; // Original position in document
}

export class SemanticMarkdownTransformer extends TextTransformer {
  private tokenizer: Tiktoken;
  private joinThreshold: number;
  private allowedSpecial: Set<string> | 'all';
  private disallowedSpecial: Set<string> | 'all';

  constructor({
    joinThreshold = 500,
    encodingName = 'cl100k_base',
    modelName,
    allowedSpecial = new Set(),
    disallowedSpecial = 'all',
    ...baseOptions
  }: SemanticMarkdownChunkOptions = {}) {
    super(baseOptions);

    this.joinThreshold = joinThreshold;
    this.allowedSpecial = allowedSpecial;
    this.disallowedSpecial = disallowedSpecial;

    try {
      this.tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
    } catch {
      throw new Error('Could not load tiktoken encoding. Please install it with `npm install js-tiktoken`.');
    }
  }

  private countTokens(text: string): number {
    const allowed = this.allowedSpecial === 'all' ? 'all' : Array.from(this.allowedSpecial);
    const disallowed = this.disallowedSpecial === 'all' ? 'all' : Array.from(this.disallowedSpecial);

    const processedText = this.stripWhitespace ? text.trim() : text;
    return this.tokenizer.encode(processedText, allowed, disallowed).length;
  }

  private splitMarkdownByHeaders(markdown: string): MarkdownNode[] {
    const sections: MarkdownNode[] = [];
    const lines = markdown.split('\n');
    let currentContent = '';
    let currentTitle = '';
    let currentDepth = 0;
    let inCodeBlock = false;
    let currentStartIndex = 0;

    const headerRegex = /^(#+)\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const headerMatch = line.match(headerRegex);

      // Track code blocks to avoid parsing headers inside them
      if (line.startsWith('```') || line.startsWith('~~~')) {
        inCodeBlock = !inCodeBlock;
      }

      if (headerMatch && !inCodeBlock) {
        // Save previous section
        // Push the previous section if it has content or if it's a header.
        // This ensures headers that only act as parents are not lost.
        if (currentContent.trim() !== '' || (currentTitle && currentDepth > 0)) {
          sections.push({
            title: currentTitle,
            content: currentContent.trim(),
            depth: currentDepth,
            length: this.countTokens(currentContent.trim()),
            startIndex: currentStartIndex,
          });
        }
        currentContent = ''; // Always reset for the new section

        // Start new section
        currentDepth = headerMatch[1]!.length;
        currentTitle = headerMatch[2]!;
        currentStartIndex = i;
      } else {
        currentContent += line + '\n';
      }
    }

    // Add the last section
    if (currentContent.trim() !== '') {
      sections.push({
        title: currentTitle,
        content: currentContent.trim(),
        depth: currentDepth,
        length: this.countTokens(currentContent.trim()),
        startIndex: currentStartIndex,
      });
    }

    // Remove initial empty preamble if present, but keep non-empty preambles
    if (sections.length > 1 && sections[0]!.title === '' && sections[0]!.content.trim() === '') {
      sections.shift();
    }

    return sections;
  }

  private mergeSemanticSections(sections: MarkdownNode[]): MarkdownNode[] {
    if (sections.length === 0) return sections;

    const workingSections = [...sections];
    const deepest = Math.max(...workingSections.map(s => s.depth));

    for (let depth = deepest; depth > 0; depth--) {
      let i = 0;
      while (i < workingSections.length) {
        const current = workingSections[i]!;
        if (current.depth !== depth) {
          i++;
          continue;
        }

        let mergeTargetIndex = -1;
        for (let j = i - 1; j >= 0; j--) {
          const potentialTarget = workingSections[j]!;
          if (potentialTarget.depth < current.depth) {
            mergeTargetIndex = j;
            break;
          }
          if (potentialTarget.depth === current.depth) {
            mergeTargetIndex = j;
            break;
          }
        }

        if (mergeTargetIndex !== -1) {
          const targetNode = workingSections[mergeTargetIndex]!;
          const combinedLength = targetNode.length + current.length;

          if (combinedLength < this.joinThreshold) {
            const title = `${'#'.repeat(current.depth)} ${current.title}`;
            const formattedContent = `\n\n${title}\n${current.content}`;
            targetNode.content += formattedContent;
            targetNode.length += this.countTokens(formattedContent);

            if (targetNode.depth === current.depth) {
              targetNode.title = targetNode.title ? `${targetNode.title} & ${current.title}` : current.title;
            }

            workingSections.splice(i, 1);
          } else {
            i++;
          }
        } else {
          i++;
        }
      }
    }

    return workingSections;
  }

  splitText({ text }: { text: string }): string[] {
    if (!text.trim()) return [];

    const initialSections = this.splitMarkdownByHeaders(text);

    const mergedSections = this.mergeSemanticSections(initialSections);

    return mergedSections.map(section => {
      if (section.title) {
        const header = `${'#'.repeat(section.depth)} ${section.title}`;
        return `${header}\n${section.content}`;
      }
      return section.content;
    });
  }

  createDocuments(texts: string[], metadatas?: Record<string, any>[]): Document[] {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    texts.forEach((text, i) => {
      this.splitText({ text }).forEach(chunk => {
        const metadata = {
          ..._metadatas[i],
        };

        if (this.addStartIndex) {
          // For semantic chunking, start index is less meaningful since we merge sections
          // But we can provide it for compatibility
          const startIndex = text.indexOf(chunk);
          if (startIndex !== -1) {
            metadata.startIndex = startIndex;
          }
        }

        documents.push(
          new Document({
            text: chunk,
            metadata,
          }),
        );
      });
    });

    return documents;
  }

  transformDocuments(documents: Document[]): Document[] {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.text);
      metadatas.push(doc.metadata);
    }

    return this.createDocuments(texts, metadatas);
  }

  /**
   * Static factory method following tiktoken pattern
   */
  static fromTikToken({
    encodingName = 'cl100k_base',
    modelName,
    options = {},
  }: {
    encodingName?: TiktokenEncoding;
    modelName?: TiktokenModel;
    options?: SemanticMarkdownChunkOptions;
  }): SemanticMarkdownTransformer {
    let tokenizer: Tiktoken;

    try {
      tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
    } catch {
      throw new Error('Could not load tiktoken encoding. Please install it with `npm install js-tiktoken`.');
    }

    // Use tiktoken for length function
    const tikTokenCounter = (text: string): number => {
      const allowed =
        options.allowedSpecial === 'all' ? 'all' : options.allowedSpecial ? Array.from(options.allowedSpecial) : [];
      const disallowed =
        options.disallowedSpecial === 'all'
          ? 'all'
          : options.disallowedSpecial
            ? Array.from(options.disallowedSpecial)
            : [];
      return tokenizer.encode(text, allowed, disallowed).length;
    };

    return new SemanticMarkdownTransformer({
      ...options,
      encodingName,
      modelName,
      lengthFunction: tikTokenCounter,
    });
  }
}
