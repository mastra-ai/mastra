interface EmbeddingModelConfigBase {
  name: string;
}

export type OpenAIEmbeddingModelNames =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

export type OpenAIEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'OPEN_AI';
  name: OpenAIEmbeddingModelNames;
};

export type CohereEmbeddingModelNames =
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

export type AmazonBedrockEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'AMAZON';
  name: AmazonBedrockEmbeddingModelNames;
};

export type GoogleEmbeddingModelNames = 'text-embedding-004' | (string & {});

export type GoogleEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'GOOGLE';
  name: GoogleEmbeddingModelNames;
};

export type MistralEmbeddingModelNames = 'mistral-embed' | (string & {});

export type MistralEmbeddingConfig = EmbeddingModelConfigBase & {
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

export type VoyageEmbeddingConfig = EmbeddingModelConfigBase & {
  provider: 'VOYAGE';
  name: VoyageEmbeddingModelNames;
};

export type EmbeddingModelConfig =
  | OpenAIEmbeddingConfig
  | CohereEmbeddingConfig
  | AmazonBedrockEmbeddingConfig
  | GoogleEmbeddingConfig
  | MistralEmbeddingConfig
  | VoyageEmbeddingConfig;
