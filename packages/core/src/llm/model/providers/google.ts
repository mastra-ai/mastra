import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { MastraLLM } from '../model';

export interface GoogleGenerativeAISettings {
  /**
    Optional.
    The name of the cached content used as context to serve the prediction.
    Format: cachedContents/{cachedContent}
       */
  cachedContent?: string;
  /**
   * Optional. Enable structured output. Default is true.
   *
   * This is useful when the JSON Schema contains elements that are
   * not supported by the OpenAPI schema version that
   * Google Generative AI uses. You can use this to disable
   * structured outputs if you need to.
   */
  structuredOutputs?: boolean;
  /**
    Optional. A list of unique safety settings for blocking unsafe content.
       */
  safetySettings?: Array<{
    category:
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

export type GoogleModel =
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash-exp-latest'
  | 'gemini-2.0-flash-thinking-exp-1219'
  | 'gemini-exp-1206'
  | (string & {});

export class Gemini extends MastraLLM {
  constructor({
    name = 'gemini-1.5-pro-latest',
    apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    settings,
  }: { name?: GoogleModel; apiKey?: string; settings?: GoogleGenerativeAISettings } = {}) {
    const google = createGoogleGenerativeAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey,
    });

    const gemini = google(name, settings);

    super({ model: gemini });
  }
}
