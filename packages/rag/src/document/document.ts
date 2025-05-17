import { TitleExtractor, SummaryExtractor, QuestionsAnsweredExtractor, KeywordExtractor } from './extractors';
import type { BaseNode } from './schema';
import { Document as Chunk, NodeRelationship, ObjectType } from './schema';

import { CharacterTransformer, RecursiveCharacterTransformer } from './transformers/character';
import { HTMLHeaderTransformer, HTMLSectionTransformer } from './transformers/html';
import { RecursiveJsonTransformer } from './transformers/json';
import { LatexTransformer } from './transformers/latex';
import { MarkdownHeaderTransformer, MarkdownTransformer } from './transformers/markdown';
import { TokenTransformer } from './transformers/token';
import type {
  CharacterChunkOptions,
  ChunkParams,
  ChunkStrategy,
  ExtractParams,
  HtmlChunkOptions,
  JsonChunkOptions,
  LatexChunkOptions,
  MarkdownChunkOptions,
  RecursiveChunkOptions,
  StrategyOptions,
  TokenChunkOptions,
} from './types';

export class MDocument {
  private chunks: Chunk[];
  private type: string; // e.g., 'text', 'html', 'markdown', 'json'

  constructor({ docs, type }: { docs: { text: string; metadata?: Record<string, any> }[]; type: string }) {
    this.chunks = docs.map(d => {
      return new Chunk({ text: d.text, metadata: d.metadata });
    });
    this.type = type;
  }

  async extractMetadata({ title, summary, questions, keywords }: ExtractParams): Promise<MDocument> {
    const transformations = [];

    if (typeof summary !== 'undefined') {
      transformations.push(new SummaryExtractor(typeof summary === 'boolean' ? {} : summary));
    }

    if (typeof questions !== 'undefined') {
      transformations.push(new QuestionsAnsweredExtractor(typeof questions === 'boolean' ? {} : questions));
    }

    if (typeof keywords !== 'undefined') {
      transformations.push(new KeywordExtractor(typeof keywords === 'boolean' ? {} : keywords));
    }

    if (typeof title !== 'undefined') {
      transformations.push(new TitleExtractor(typeof title === 'boolean' ? {} : title));
      this.chunks = this.chunks.map(doc =>
        doc?.metadata?.docId
          ? new Chunk({
              ...doc,
              relationships: {
                [NodeRelationship.SOURCE]: {
                  nodeId: doc.metadata.docId,
                  nodeType: ObjectType.DOCUMENT,
                  metadata: doc.metadata,
                },
              },
            })
          : doc,
      );
    }

    let nodes: BaseNode[] = this.chunks;
    for (const extractor of transformations) {
      nodes = await extractor.processNodes(nodes);
    }

    this.chunks = this.chunks.map((doc, i) => {
      return new Chunk({
        text: doc.text,
        metadata: {
          ...doc.metadata,
          ...(nodes?.[i]?.metadata || {}),
        },
      });
    });

    return this;
  }

  static fromText(text: string, metadata?: Record<string, any>): MDocument {
    return new MDocument({
      docs: [
        {
          text,
          metadata,
        },
      ],
      type: 'text',
    });
  }

  static fromHTML(html: string, metadata?: Record<string, any>): MDocument {
    return new MDocument({
      docs: [
        {
          text: html,
          metadata,
        },
      ],
      type: 'html',
    });
  }

  static fromMarkdown(markdown: string, metadata?: Record<string, any>): MDocument {
    return new MDocument({
      docs: [
        {
          text: markdown,
          metadata,
        },
      ],
      type: 'markdown',
    });
  }

  static fromJSON(jsonString: string, metadata?: Record<string, any>): MDocument {
    return new MDocument({
      docs: [
        {
          text: jsonString,
          metadata,
        },
      ],
      type: 'json',
    });
  }

  private defaultStrategy(): ChunkStrategy {
    switch (this.type) {
      case 'html':
        return 'html';
      case 'markdown':
        return 'markdown';
      case 'json':
        return 'json';
      case 'latex':
        return 'latex';
      default:
        return 'recursive';
    }
  }

  private async chunkBy(strategy: ChunkStrategy, options?: StrategyOptions): Promise<void> {
    // Warn if deprecated flat ChunkOptions fields are present
    const {
      characterOptions,
      tokenOptions,
      markdownOptions,
      htmlOptions,
      recursiveOptions,
      jsonOptions,
      latexOptions,
      ...rest
    } = options || {};
    // Remove known non-option fields (strategy, extract, etc.) from rest if needed

    const restObj = rest as Record<string, unknown>;

    const legacyFields = Object.keys(restObj).filter(
      key => !['strategy', 'extract'].includes(key) && restObj[key] !== undefined,
    );
    if (legacyFields.length > 0) {
      console.warn(
        '[DEPRECATION] Passing chunking options directly to ChunkParams is deprecated. Use the dedicated strategy-specific options fields instead. Support will be removed after May 20th, 2025.',
        { deprecatedFields: legacyFields },
      );
    }
    switch (strategy) {
      case 'recursive':
        await this.chunkRecursive({ ...restObj, ...recursiveOptions });
        break;
      case 'character':
        await this.chunkCharacter({ ...restObj, ...characterOptions });
        break;
      case 'token':
        await this.chunkToken({ ...restObj, ...tokenOptions });
        break;
      case 'markdown':
        await this.chunkMarkdown({ ...restObj, ...markdownOptions });
        break;
      case 'html':
        await this.chunkHTML({ ...restObj, ...htmlOptions });
        break;
      case 'json':
        await this.chunkJSON({ ...restObj, ...jsonOptions });
        break;
      case 'latex':
        await this.chunkLatex({ ...restObj, ...latexOptions });
        break;
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  async chunkRecursive(options?: RecursiveChunkOptions): Promise<void> {
    if (options?.language) {
      const rt = RecursiveCharacterTransformer.fromLanguage(options);
      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    const rt = new RecursiveCharacterTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkCharacter(options?: CharacterChunkOptions): Promise<void> {
    const rt = new CharacterTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkHTML(options?: HtmlChunkOptions): Promise<void> {
    if (options?.headers?.length) {
      const rt = new HTMLHeaderTransformer(options);

      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    if (options?.sections?.length) {
      const rt = new HTMLSectionTransformer(options);

      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    throw new Error('HTML chunking requires either headers or sections to be specified');
  }

  async chunkJSON(options?: JsonChunkOptions): Promise<void> {
    if (!options?.maxSize) {
      throw new Error('JSON chunking requires maxSize to be specified');
    }

    const rt = new RecursiveJsonTransformer(options);

    const textSplit = rt.transformDocuments({
      documents: this.chunks,
      ensureAscii: options?.ensureAscii,
      convertLists: options?.convertLists,
    });

    this.chunks = textSplit;
  }

  async chunkLatex(options?: LatexChunkOptions): Promise<void> {
    const rt = new LatexTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkToken(options?: TokenChunkOptions): Promise<void> {
    const rt = TokenTransformer.fromTikToken(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkMarkdown(options?: MarkdownChunkOptions): Promise<void> {
    if (options?.headers) {
      const rt = new MarkdownHeaderTransformer(options);
      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    const rt = new MarkdownTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunk(params?: ChunkParams): Promise<Chunk[]> {
    const { strategy: passedStrategy, extract, ...chunkOptions } = params || {};
    // Determine the default strategy based on type if not specified
    const strategy = passedStrategy || this.defaultStrategy();

    // Apply the appropriate chunking strategy
    await this.chunkBy(strategy, chunkOptions);

    if (extract) {
      await this.extractMetadata(extract);
    }

    return this.chunks;
  }

  getDocs(): Chunk[] {
    return this.chunks;
  }

  getText(): string[] {
    return this.chunks.map(doc => doc.text);
  }

  getMetadata(): Record<string, any>[] {
    return this.chunks.map(doc => doc.metadata);
  }
}
