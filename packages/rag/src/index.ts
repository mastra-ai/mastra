import { Tokenizer } from "@llamaindex/env/tokenizers/dist";
import { Document, SummaryExtractor, IngestionPipeline, LLM, TitleCombinePrompt, TitleExtractor, TitleExtractorPrompt, SummaryPrompt, QuestionsAnsweredExtractor, QuestionExtractPrompt, KeywordExtractor, KeywordExtractPrompt, SentenceSplitter, sentenceSplitterSchema } from "llamaindex";
import { z } from 'zod';

interface DocumentInitializer { text: string, metadata?: Record<string, any> }

type TitleExtractorsArgs = {
    llm?: LLM;
    nodes?: number;
    nodeTemplate?: TitleExtractorPrompt["template"];
    combineTemplate?: TitleCombinePrompt["template"];
};

type SummaryExtractArgs = {
    llm?: LLM;
    summaries?: string[];
    promptTemplate?: SummaryPrompt["template"];
};

type QuestionAnswerExtractArgs = {
    llm?: LLM;
    questions?: number;
    promptTemplate?: QuestionExtractPrompt["template"];
    embeddingOnly?: boolean;
};

type KeywordExtractArgs = {
    llm?: LLM;
    keywords?: number;
    promptTemplate?: KeywordExtractPrompt["template"];
};

type SplitterParams = {
    tokenizer?: Tokenizer;
};

type SentenceParam = z.infer<typeof sentenceSplitterSchema> & SplitterParams

export class MastraDocument {
    documents: Document[]
    constructor(config: DocumentInitializer | DocumentInitializer[]) {
        if (Array.isArray(config)) {
            this.documents = config.map(({ text, metadata }) => new Document({ text, metadata }));
        } else {
            this.documents = [new Document(config)];
        }
    }

    async extractMetadata({ title, summary, questionsAnswered, keyword, sentence }: { sentence?: SentenceParam, title?: TitleExtractorsArgs, summary?: SummaryExtractArgs, questionsAnswered?: QuestionAnswerExtractArgs, keyword?: KeywordExtractArgs }) {
        const transformations = []

        if (Object.keys(title || {}).length > 0) {
            transformations.push(new TitleExtractor(title))
        }

        if (Object.keys(summary || {}).length > 0) {
            transformations.push(new SummaryExtractor(summary))
        }

        if (Object.keys(questionsAnswered || {}).length > 0) {
            transformations.push(new QuestionsAnsweredExtractor(questionsAnswered))
        }

        if (Object.keys(keyword || {}).length > 0) {
            transformations.push(new KeywordExtractor(keyword))
        }

        if (Object.keys(sentence || {}).length > 0) {
            transformations.push(new SentenceSplitter(sentence))
        }

        const pipeline = new IngestionPipeline({
            transformations,
        });

        const nodes = await pipeline.run({
            documents: this.documents,
        });

        return nodes
    }
}