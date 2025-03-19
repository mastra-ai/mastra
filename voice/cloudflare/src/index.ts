import type {
  Ai,
  Ai_Cf_Openai_Whisper_Large_V3_Turbo_Output,
  Ai_Cf_Openai_Whisper_Output,
  Ai_Cf_Openai_Whisper_Tiny_En_Output,
} from '@cloudflare/workers-types';
import { MastraVoice } from '@mastra/core/voice';
import Cloudflare from 'cloudflare';

interface CloudflareListenOptions {
  apiKey?: string;
  model?: '@cf/openai/whisper-tiny-en' | '@cf/openai/whisper' | '@cf/openai/whisper-large-v3-turbo';
  account_id?: string;
}

type CloudflareListenOutput =
  | Ai_Cf_Openai_Whisper_Tiny_En_Output
  | Ai_Cf_Openai_Whisper_Large_V3_Turbo_Output
  | Ai_Cf_Openai_Whisper_Output;

const defaultListeningModel = {
  model: '@cf/openai/whisper-large-v3-turbo' as const,
  apiKey: process.env.CLOUDFLARE_AI_API_KEY,
  account_id: process.env.CLOUDFLARE_ACCOUNT_ID!,
};

export class CloudflareVoice extends MastraVoice {
  private apiToken?: string;
  private client: Cloudflare | null = null;
  private binding?: Ai;

  constructor({
    listeningModel,
    binding,
  }: {
    listeningModel?: CloudflareListenOptions;
    binding?: Ai;
  } = {}) {
    super({
      listeningModel: {
        name: listeningModel?.model ?? defaultListeningModel.model,
        apiKey: listeningModel?.apiKey ?? defaultListeningModel.apiKey,
      },
    });

    // Store Workers AI binding if provided
    this.binding = binding;

    // Only setup REST client if no binding provided or both are needed
    if (!binding) {
      this.apiToken = listeningModel?.apiKey || defaultListeningModel.apiKey;
      if (!this.apiToken) {
        throw new Error('CLOUDFLARE_AI_API_KEY must be set when not using bindings');
      }
      this.client = new Cloudflare({ apiToken: this.apiToken });
    }
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: CloudflareListenOptions): Promise<string> {
    return this.traced(async () => {
      // Collect audio data into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      const audioBuffer = Buffer.concat(chunks);

      // Convert the audio buffer into an array of numbers (8-bit unsigned integers)
      const audioArray = Array.from(new Uint8Array(audioBuffer));
      const model = options?.model || defaultListeningModel.model;

      // Use native binding if available, otherwise use REST API
      if (this.binding) {
        // Using Workers AI binding
        const response = (await this.binding.run(model, {
          audio: audioArray,
        })) as CloudflareListenOutput;
        return response.text;
      } else if (this.client) {
        // Using REST API client
        const payload = { audio: audioArray, account_id: options?.account_id || defaultListeningModel.account_id };
        const response = (await this.client.ai.run(model, payload)) as any;
        return response.text as string;
      } else {
        throw new Error('Neither binding nor REST client is configured');
      }
    }, 'voice.cloudflare.listen')();
  }
  async speak(): Promise<NodeJS.ReadableStream> {
    throw new Error('This feature is not yet implemented.');
  }
  async getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    throw new Error('This feature is not yet implemented.');
  }
}
