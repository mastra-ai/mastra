import {
  MarkdownNodeParser,
  Document,
  SummaryExtractor,
  IngestionPipeline,
  LLM,
  TitleCombinePrompt,
  TitleExtractor,
  TitleExtractorPrompt,
  SummaryPrompt,
  QuestionsAnsweredExtractor,
  QuestionExtractPrompt,
  KeywordExtractor,
  KeywordExtractPrompt,
  SentenceSplitter,
  sentenceSplitterSchema,
} from 'llamaindex';
import { z } from 'zod';

interface Tokenizer {
  encode: (text: string) => Uint32Array;
  decode: (tokens: Uint32Array) => string;
}

interface DocumentInitializer {
  text: string;
  metadata?: Record<string, any>;
}

type TitleExtractorsArgs = {
  llm?: LLM;
  nodes?: number;
  nodeTemplate?: TitleExtractorPrompt['template'];
  combineTemplate?: TitleCombinePrompt['template'];
};

type SummaryExtractArgs = {
  llm?: LLM;
  summaries?: string[];
  promptTemplate?: SummaryPrompt['template'];
};

type QuestionAnswerExtractArgs = {
  llm?: LLM;
  questions?: number;
  promptTemplate?: QuestionExtractPrompt['template'];
  embeddingOnly?: boolean;
};

type KeywordExtractArgs = {
  llm?: LLM;
  keywords?: number;
  promptTemplate?: KeywordExtractPrompt['template'];
};

type SplitterParams = {
  tokenizer?: Tokenizer;
};

type SentenceParam = z.infer<typeof sentenceSplitterSchema> & SplitterParams;

export class MastraDocument {
  documents: Document[];
  constructor(config: DocumentInitializer | DocumentInitializer[]) {
    if (Array.isArray(config)) {
      this.documents = config.map(({ text, metadata }) => new Document({ text, metadata }));
    } else {
      this.documents = [new Document(config)];
    }
  }

  async chunk({
    strategy,
    metadataExtraction = {},
    parseMarkdown,
  }: {
    parseMarkdown?: boolean;
    strategy: SentenceParam;
    metadataExtraction?: {
      title?: TitleExtractorsArgs | boolean;
      summary?: SummaryExtractArgs | boolean;
      questionsAnswered?: QuestionAnswerExtractArgs | boolean;
      keyword?: KeywordExtractArgs | boolean;
    };
  }) {
    const { title, summary, questionsAnswered, keyword } = metadataExtraction;
    const transformations = [];

    if (parseMarkdown) {
      transformations.push(new MarkdownNodeParser());
    }

    transformations.push(new SentenceSplitter(strategy));

    if (typeof title !== 'undefined') {
      transformations.push(new TitleExtractor(typeof title === 'boolean' ? {} : title));
    }

    if (typeof summary !== 'undefined') {
      transformations.push(new SummaryExtractor(typeof summary === 'boolean' ? {} : summary));
    }

    if (typeof questionsAnswered !== 'undefined') {
      transformations.push(
        new QuestionsAnsweredExtractor(typeof questionsAnswered === 'boolean' ? {} : questionsAnswered),
      );
    }

    if (typeof keyword !== 'undefined') {
      transformations.push(new KeywordExtractor(typeof keyword === 'boolean' ? {} : keyword));
    }

    const pipeline = new IngestionPipeline({
      transformations,
    });

    const nodes = await pipeline.run({
      documents: this.documents,
    });

    return nodes;
  }
}
