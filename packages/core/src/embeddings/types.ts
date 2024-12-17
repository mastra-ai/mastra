interface EmbeddingModelConfigBase {
  model: string;
}

type OpenAIEmbeddingModelNames =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

type OpenAIEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'OPEN_AI';
  model: OpenAIEmbeddingModelNames;
};

type CohereEmbeddingModelNames =
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-light-v3.0'
  | 'embed-english-v2.0'
  | 'embed-english-light-v2.0'
  | 'embed-multilingual-v2.0'
  | (string & {});

export type CohereEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'COHERE';
  model: CohereEmbeddingModelNames;
};

export type AmazonBedrockEmbeddingModelNames =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | (string & {});

type AmazonBedrockEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'AMAZON';
  model: AmazonBedrockEmbeddingModelNames;
};

type GoogleEmbeddingModelNames = 'text-embedding-004' | (string & {});
type GoogleEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'GOOGLE';
  model: GoogleEmbeddingModelNames;
};

type MistralEmbeddingModelNames = 'mistral-embed' | (string & {});

type MistralEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'MISTRAL';
  model: MistralEmbeddingModelNames;
};

export type VoyageEmbeddingModelNames =
  | 'voyage-3'
  | 'voyage-3-lite'
  | 'voyage-finance-2'
  | 'voyage-multilingual-2'
  | 'voyage-law-2'
  | 'voyage-code-2'
  | 'voyage-3-lite'
  | (string & {});

type VoyageEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'VOYAGE';
  model: VoyageEmbeddingModelNames;
};

type EmbeddingConfig =
  | OpenAIEmbeddingConfig
  | CohereEmbeddingConfig
  | AmazonBedrockEmbeddingConfig
  | GoogleEmbeddingConfig
  | MistralEmbeddingConfig
  | VoyageEmbeddingConfig;

export type EmbeddingOptions = {
  apiKey?: string;
  maxRetries: number;
} & EmbeddingConfig;
