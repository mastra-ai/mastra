import axios, { type AxiosInstance } from 'axios';
import { type GenerationRequest, generationRequestSchema } from './zodSchema'

export class StabilityAIClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.stability.ai/v2beta',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  async generateImageFromPrompt (...args: Parameters<typeof StabilityAIClient.createGenerationRequest>) {
    const request = StabilityAIClient.createGenerationRequest(...args)
    return this.generateImage(request)
  }

  async generateImage(params: GenerationRequest): Promise<string> {
    try {
      if (!this.apiKey) throw new Error('STABILITYAI_API_KEY is required in order to generate images')
      
      // Validate request parameters
      const validated = generationRequestSchema.parse(params);

      const response = await this.client.postForm<string>(
        '/stable-image/generate/ultra',
        validated,
        { headers: { Accept: 'image/*' }, responseType: 'arraybuffer' }
      );

      const buffer = Buffer.from(response.data, 'binary').toString('base64')

      return buffer;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Stability AI API Error: ${error.response?.data?.message || error.message}`)
      }
      throw error;
    }
  }

  // Helper method to create a basic generation request
  static createGenerationRequest(
    prompt: string,
    options: Partial<Omit<GenerationRequest, 'prompt'>> = {}
  ): GenerationRequest {
    // Validate the request before returning
    return generationRequestSchema.parse({
      prompt,
      ...options
    });
  }

  getExtFromRequest (params: Partial<GenerationRequest>) {
    return `.${params.output_format || 'png'}`
  }
}

// Example usage:
/*
const client = new StabilityAIClient('your-api-key');

const request = StabilityAIClient.createGenerationRequest('A beautiful sunset over mountains', {
  width: 1024,
  height: 1024,
  style_preset: 'digital-art'
});

const response = await client.generateImage(request);
*/