import type { TiktokenModel, TiktokenEncoding, Tiktoken } from 'js-tiktoken';
import { encodingForModel, getEncoding } from 'js-tiktoken';
import { Document } from '../schema';
import type { SemanticMarkdownChunkOptions } from '../types';

import { TextTransformer } from './text';

interface MarkdownNode {
  title: string;
  depth: number;
  content: string;
  length: number;
}

export class SemanticMarkdownTransformer extends TextTransformer {
  private tokenizer: Tiktoken;
  private joinThreshold: number;
  private allowedArray: string[] | 'all';
  private disallowedArray: string[] | 'all';

  constructor({
    joinThreshold = 500,
    encodingName = 'cl100k_base',
    modelName,
    tokenizer: existingTokenizer,
    allowedSpecial = new Set(),
    disallowedSpecial = 'all',
    ...baseOptions
  }: SemanticMarkdownChunkOptions & { tokenizer?: Tiktoken } = {}) {
    super(baseOptions);

    this.joinThreshold = joinThreshold;
    this.allowedArray = allowedSpecial === 'all' ? 'all' : Array.from(allowedSpecial);
    this.disallowedArray = disallowedSpecial === 'all' ? 'all' : Array.from(disallowedSpecial);

    if (existingTokenizer) {
      this.tokenizer = existingTokenizer;
    } else {
      try {
        this.tokenizer = modelName ? encodingForModel(modelName) : getEncoding(encodingName);
      } catch {
        throw new Error('Could not load tiktoken encoding. Please install it with `npm install js-tiktoken`.');
      }
    }
  }

  private countTokens(text: string): number {
    const processedText = this.stripWhitespace ? text.trim() : text;
    return this.tokenizer.encode(processedText, this.allowedArray, this.disallowedArray).length;
  }

  private splitMarkdownByHeaders(markdown: string): MarkdownNode[] {
    const sections: MarkdownNode[] = [];
    const lines = markdown.split('\n');
    let currentContent = '';
    let currentTitle = '';
    let currentDepth = 0;
    let inCodeBlock = false;

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
          });
        }
        currentContent = ''; // Always reset for the new section

        // Start new section
        currentDepth = headerMatch[1]!.length;
        currentTitle = headerMatch[2]!;
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
      for (let j = 1; j < workingSections.length; j++) {
        const current = workingSections[j]!;

        if (current.depth === depth) {
          const prev = workingSections[j - 1]!;

          const title = `${'#'.repeat(current.depth)} ${current.title}`;
          const formattedTitle = `\n\n${title}`;
          const headerLength = this.tokenizer.encode(
            `${formattedTitle}\n`,
            this.allowedArray,
            this.disallowedArray,
          ).length;
          const mergedLength = prev.length + current.length + headerLength;

          if (mergedLength < this.joinThreshold && prev.depth <= current.depth) {
            prev.content += `${formattedTitle}\n${current.content}`;

            prev.length = mergedLength;

            workingSections.splice(j, 1);
            j--;
          }
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
          tokenCount: this.countTokens(chunk),
        };

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
      tokenizer,
      lengthFunction: tikTokenCounter,
    });
  }
}
