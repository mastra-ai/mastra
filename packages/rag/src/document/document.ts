import { TitleExtractor, SummaryExtractor, QuestionsAnsweredExtractor, KeywordExtractor } from './extractors';
import type { BaseNode } from './schema';
import { Document as Chunk, NodeRelationship, ObjectType } from './schema';

import { CharacterTransformer, RecursiveCharacterTransformer } from './transformers/character';
import { HTMLHeaderTransformer, HTMLSectionTransformer } from './transformers/html';
import { RecursiveJsonTransformer } from './transformers/json';
import { LatexTransformer } from './transformers/latex';
import { MarkdownHeaderTransformer, MarkdownTransformer } from './transformers/markdown';
import { SemanticMarkdownTransformer } from './transformers/semantic-markdown';
import { SentenceTransformer } from './transformers/sentence';
import { TokenTransformer } from './transformers/token';
import type {
  ChunkParams,
  ChunkStrategy,
  ExtractParams,
  HTMLChunkOptions,
  RecursiveChunkOptions,
  CharacterChunkOptions,
  TokenChunkOptions,
  MarkdownChunkOptions,
  SemanticMarkdownChunkOptions,
  JsonChunkOptions,
  LatexChunkOptions,
  SentenceChunkOptions,
  StrategyOptions,
} from './types';
import { validateChunkParams } from './validation';

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

  private _strategyMap?: { [S in ChunkStrategy]: (options?: StrategyOptions[S]) => Promise<void> };

  private get strategyMap() {
    if (!this._strategyMap) {
      this._strategyMap = {
        recursive: options => this.chunkRecursive(options),
        character: options => this.chunkCharacter(options),
        token: options => this.chunkToken(options),
        markdown: options => this.chunkMarkdown(options),
        html: options => this.chunkHTML(options),
        json: options => this.chunkJSON(options),
        latex: options => this.chunkLatex(options),
        sentence: options => this.chunkSentence(options),
        'semantic-markdown': options => this.chunkSemanticMarkdown(options),
      };
    }
    return this._strategyMap;
  }

  private async chunkBy<K extends ChunkStrategy>(strategy: K, options?: StrategyOptions[K]): Promise<void> {
    const chunkingFunc = this.strategyMap[strategy];
    if (chunkingFunc) {
      await chunkingFunc(options);
    } else {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  async chunkRecursive(options?: RecursiveChunkOptions): Promise<void> {
    if (options?.language) {
      const rt = RecursiveCharacterTransformer.fromLanguage(options.language, options);
      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    const rt = new RecursiveCharacterTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkCharacter(options?: CharacterChunkOptions): Promise<void> {
    const rt = new CharacterTransformer({
      ...options,
      separator: options?.separator,
      isSeparatorRegex: options?.isSeparatorRegex,
    });
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkHTML(options?: HTMLChunkOptions): Promise<void> {
    if (options?.headers?.length) {
      const rt = new HTMLHeaderTransformer(options as HTMLChunkOptions & { headers: [string, string][] });

      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    if (options?.sections?.length) {
      const rt = new HTMLSectionTransformer(options as HTMLChunkOptions & { sections: [string, string][] });

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

    const rt = new RecursiveJsonTransformer({
      maxSize: options?.maxSize,
      minSize: options?.minSize,
    });

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
    const rt = TokenTransformer.fromTikToken({
      options,
      encodingName: options?.encodingName,
      modelName: options?.modelName,
    });
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkMarkdown(options?: MarkdownChunkOptions): Promise<void> {
    if (options?.headers) {
      const rt = new MarkdownHeaderTransformer(options.headers, options?.returnEachLine, options?.stripHeaders);
      const textSplit = rt.transformDocuments(this.chunks);
      this.chunks = textSplit;
      return;
    }

    const rt = new MarkdownTransformer(options);
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkSentence(options?: SentenceChunkOptions): Promise<void> {
    if (!options?.maxSize) {
      throw new Error('Sentence chunking requires maxSize to be specified');
    }

    const rt = new SentenceTransformer({
      minSize: options?.minSize,
      maxSize: options?.maxSize,
      targetSize: options?.targetSize,
      overlap: options?.overlap,
      sentenceEnders: options?.sentenceEnders,
      fallbackToWords: options?.fallbackToWords,
      fallbackToCharacters: options?.fallbackToCharacters,
      keepSeparator: options?.keepSeparator,
      lengthFunction: options?.lengthFunction,
      addStartIndex: options?.addStartIndex,
      stripWhitespace: options?.stripWhitespace,
    });

    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunkSemanticMarkdown(options?: SemanticMarkdownChunkOptions): Promise<void> {
    const rt = SemanticMarkdownTransformer.fromTikToken({
      options,
      encodingName: options?.encodingName,
      modelName: options?.modelName,
    });
    const textSplit = rt.transformDocuments(this.chunks);
    this.chunks = textSplit;
  }

  async chunk(params?: ChunkParams): Promise<Chunk[]> {
    const { strategy: passedStrategy, extract, ...chunkOptions } = params || {};
    // Determine the default strategy based on type if not specified
    const strategy = passedStrategy || this.defaultStrategy();

    validateChunkParams(strategy, chunkOptions);

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
