interface EmbeddingModelConfigBase {
  name: string;
}

type OpenAIEmbeddingModelNames =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

type OpenAIEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'OPEN_AI';
  name: OpenAIEmbeddingModelNames;
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
  name: CohereEmbeddingModelNames;
};

export type AmazonBedrockEmbeddingModelNames =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | (string & {});

type AmazonBedrockEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'AMAZON';
  name: AmazonBedrockEmbeddingModelNames;
};

type GoogleEmbeddingModelNames = 'text-embedding-004' | (string & {});
type GoogleEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'GOOGLE';
  name: GoogleEmbeddingModelNames;
};

type MistralEmbeddingModelNames = 'mistral-embed' | (string & {});

type MistralEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'MISTRAL';
  name: MistralEmbeddingModelNames;
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
  name: VoyageEmbeddingModelNames;
};

type EmbeddingConfig =
  | OpenAIEmbeddingConfig
  | CohereEmbeddingConfig
  | AmazonBedrockEmbeddingConfig
  | GoogleEmbeddingConfig
  | MistralEmbeddingConfig
  | VoyageEmbeddingConfig;

export type EmbeddingModelConfig = EmbeddingConfig & { apiKey?: string };

export type EmbeddingOptions = {
  model: EmbeddingModelConfig;
  value: string[] | string;
  maxRetries: number;
};
