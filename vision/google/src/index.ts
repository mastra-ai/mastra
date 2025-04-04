import { PassThrough } from 'stream';
import { GoogleGenAI } from '@google/genai';
import { MastraVision } from '@mastra/core/vision';

interface GoogleVisionConfig {
  apiKey?: string;
  model?: string;
}

export class GoogleVision extends MastraVision {
  private apiKey?: string;
  private model: string;
  private ai: GoogleGenAI;

  constructor({ visionModel }: { visionModel?: GoogleVisionConfig } = {}) {
    super({
      visionModel: {
        name: visionModel?.model ?? 'gemini-2.0-flash',
        apiKey: visionModel?.apiKey ?? process.env.GOOGLE_API_KEY,
      },
    });

    this.apiKey = visionModel?.apiKey || process.env.GOOGLE_API_KEY;
    this.model = visionModel?.model || 'gemini-2.0-flash';
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async analyze(videoStream: NodeJS.ReadableStream, input: string): Promise<NodeJS.ReadableStream> {
    const chunks: Buffer[] = [];

    for await (const chunk of videoStream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }

    const videoBuffer = Buffer.concat(chunks);
    const base64Video = videoBuffer.toString('base64');

    const response = await this.ai.models.generateContentStream({
      model: this.model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Video,
              mimeType: 'video/mp4',
            },
          },
        ],
        role: 'user',
      },
      config: {
        systemInstruction: input,
      },
    });

    const stream = new PassThrough();

    for await (const chunk of response) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        stream.write(text);
      }
    }
    stream.end();

    return stream;
  }
}
