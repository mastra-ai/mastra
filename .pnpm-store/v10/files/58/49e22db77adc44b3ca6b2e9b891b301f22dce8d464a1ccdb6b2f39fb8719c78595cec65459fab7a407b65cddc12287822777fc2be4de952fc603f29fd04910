export interface GetProjectUsageRequestsResponse {
  page: number;
  limit: number;
  requests: GetProjectUsageRequestResponse[];
}

export interface GetProjectUsageRequestResponse {
  request_id: string;
  created: string;
  path: string;
  api_key_id: string;
  response: {
    details: {
      usd?: number;
      duration?: number;
      total_audio?: number;
      channels?: number;
      streams?: number;
      models?: string[];
      method?: string;
      tags?: string[];
      features?: string[];
      config?: {
        alternatives?: number;
        callback?: string;
        diarize?: boolean;
        keywords?: string[];
        language?: string;
        model?: string;
        multichannel?: boolean;
        ner?: boolean;
        numerals?: boolean;
        profanity_filter?: boolean;
        punctuate?: boolean;
        redact?: string[];
        search?: string[];
        utterances?: boolean;
        [key: string]: unknown;
      };
    };
    code?: number;
    completed?: string;
  };
  callback?: {
    attempts?: number;
    code?: number;
    completed?: string;
  };
}
