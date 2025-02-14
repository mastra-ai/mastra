import { Integration } from '@mastra/core';
import { createHash } from 'crypto';

import { StabilityAIClient } from './client';
import { type StabilityAiConfig } from './types';

export class StabilityAiIntegration extends Integration<void, StabilityAIClient> {
  config: StabilityAiConfig;
  client: StabilityAIClient;

  constructor({ config }: { config: StabilityAiConfig }) {
    super();

    this.config = config;
    this.client = new StabilityAIClient(config.API_KEY);
  }

  async generateImage(prompt: string, options: Record<string, unknown> = {}) {
    const base64 = await this.client.generateImageFromPrompt(prompt, options);
    const ext = this.client.getExtFromRequest(options);

    if (!base64) {
      throw new Error('Failed to generate image');
    }

    return {
      filename: this.getFilenameFromBase64(base64, ext),
      buffer: Buffer.from(base64, 'base64'),
    };
  }

  getFilenameFromBase64(base64: string, ext = '.png') {
    const base = createHash('md5').update(base64).digest('hex');
    return `${base}${ext}`;
  }

  async getApiClient() {
    return this.client;
  }
}

