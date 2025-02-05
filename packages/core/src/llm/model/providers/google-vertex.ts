import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';

import { MastraLLM } from '../model';

export interface GoogleVertexSettings {
  /**
    Optional. The maximum number of tokens to consider when sampling.
    
    Models use nucleus sampling or combined Top-k and nucleus sampling.
    Top-k sampling considers the set of topK most probable tokens.
    Models running with nucleus sampling don't allow topK setting.
       */
  topK?: number;
  /**
    Optional. A list of unique safety settings for blocking unsafe content.
       */
  safetySettings?: Array<{
    category:
      | 'HARM_CATEGORY_UNSPECIFIED'
      | 'HARM_CATEGORY_HATE_SPEECH'
      | 'HARM_CATEGORY_DANGEROUS_CONTENT'
      | 'HARM_CATEGORY_HARASSMENT'
      | 'HARM_CATEGORY_SEXUALLY_EXPLICIT';
    threshold:
      | 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
      | 'BLOCK_LOW_AND_ABOVE'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_NONE';
  }>;
}

export type GoogleVertexModel = 'gemini-2.0-flash-exp' | 'gemini-1.5-flash' | 'gemini-1.5-pro';

export class GoogleVertex extends MastraLLM {
  constructor({
    name = 'gemini-1.5-pro',
    project = process.env.GOOGLE_VERTEX_PROJECT || '',
    location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1',
    settings,
  }: {
    name?: GoogleVertexModel;
    project?: string;
    location?: string;
    settings?: GoogleVertexSettings;
  } = {}) {
    const vertexModel = createVertex({
      project,
      location,
    });

    super({
      model: vertexModel(name, settings) as LanguageModel,
    });
  }
}
