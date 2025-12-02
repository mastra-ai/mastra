type Model = {
  name: string;
  canonical_name: string;
  architecture: string;
  languages?: string[];
  version: string;
  uuid: string;
  batch?: boolean;
  streaming?: boolean;
  formatted_output?: boolean;
  metadata?: {
    accent: string;
    color: string;
    image: string;
    sample: string;
  };
};

export type GetModelResponse = Model;

export type GetModelsResponse = {
  stt: Model[];
  tts: Model[];
};
