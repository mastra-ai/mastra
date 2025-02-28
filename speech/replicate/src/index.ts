import { PassThrough } from 'stream';
import { MastraTTS } from '@mastra/core/tts';
import Replicate from 'replicate';

interface ReplicateConfig {
  name: `${string}/${string}` | `${string}/${string}:${string}`;
  apiKey?: string;
}

export class ReplicateTTS extends MastraTTS {
  client: Replicate;
  modelId: `${string}/${string}` | `${string}/${string}:${string}`;

  constructor({ model }: { model: ReplicateConfig }) {
    super({
      model: {
        provider: 'REPLICATE',
        ...model,
      },
    });

    const auth = process.env.REPLICATE_API_TOKEN || model.apiKey;
    if (!auth) {
      throw new Error('REPLICATE_API_TOKEN is not set');
    }

    this.client = new Replicate({ auth });
    this.modelId = model.name;
  }

  async voices() {
    return this.traced(() => [{ voice_id: 'default' }], 'tts.replicate.voices')();
  }

  async generate({ text }: { voice?: string; text: string }) {
    const audioUrl = await this.traced(async () => {
      const response = await this.client.run(
        this.modelId,
        {
          input: { text },
        },
        progress => {
          this.logger.debug('Generate progress', progress);
        },
      );

      const audioResponse = await fetch(response as unknown as string);
      const audioBuffer = await audioResponse.arrayBuffer();
      return Buffer.from(audioBuffer);
    }, 'tts.replicate.generate')();

    return {
      audioResult: audioUrl,
    };
  }

  async stream({ text }: { voice?: string; text: string }) {
    const audioStream = await this.traced(async () => {
      const generator = this.client.stream(this.modelId, {
        input: { text },
      });

      const stream = new PassThrough();

      // Convert AsyncGenerator to PassThrough stream
      void (async () => {
        try {
          for await (const chunk of generator) {
            stream.write(chunk);
          }
          stream.end();
        } catch (error) {
          stream.destroy(error as Error);
        }
      })();

      return stream;
    }, 'tts.replicate.stream')();

    return {
      audioResult: audioStream,
    };
  }
}

export type { ReplicateConfig };
