import { MastraVoice } from '@mastra/core/voice';
import Replicate from 'replicate';
import { PassThrough } from 'stream';

interface ReplicateConfig {
  name: `${string}/${string}` | `${string}/${string}:${string}`;
  apiKey?: string;
}

export class ReplicateVoice extends MastraVoice {
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
    return this.traced(() => [{ voice_id: 'default' }], 'voice.replicate.voices')();
  }

  async speech({ text }: { voice?: string; text: string }) {
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
    }, 'voice.replicate.speech')();

    return {
      audioResult: audioUrl,
    };
  }

  async speechStream({ text }: { voice?: string; text: string }) {
    const audioStream = await this.traced(async () => {
      const generator = await this.client.stream(this.modelId, {
        input: { text },
      });

      const stream = new PassThrough();

      (async () => {
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
    }, 'voice.replicate.speechStream')();

    return {
      audioResult: audioStream,
    };
  }
  async transcribe({ audio }: { audio: Buffer }): Promise<{ text: string }> {
    const text = await this.traced(async () => {
      // Create a base64 string from the audio buffer
      const base64Audio = audio.toString('base64');

      const response = await this.client.run(
        this.modelId,
        {
          input: {
            audio: `data:audio/wav;base64,${base64Audio}`,
            language: 'en',
          },
        },
        progress => {
          this.logger.debug('Transcribe progress', progress);
        },
      );

      const result = response as { text: string };
      return result.text;
    }, 'voice.replicate.transcribe')();

    return { text };
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }): Promise<NodeJS.ReadableStream> {
    const outputStream = new PassThrough();

    // Start processing in background but ensure error handling
    this.traced(async () => {
      try {
        // Collect audio chunks
        const chunks: Buffer[] = [];
        for await (const chunk of audio) {
          chunks.push(Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);
        const base64Audio = audioBuffer.toString('base64');

        // Use Replicate's run method which is more reliable for this use case
        const response = await this.client.run(this.modelId, {
          input: {
            audio: `data:audio/wav;base64,${base64Audio}`,
            language: 'en',
          },
        });

        // Write the result as a Buffer
        const result = response as { text: string };
        outputStream.write(Buffer.from(result.text));
        outputStream.end();
      } catch (error) {
        outputStream.destroy(error as Error);
      }
    }, 'voice.replicate.transcribeStream')();

    return outputStream;
  }
}

export type { ReplicateConfig };
