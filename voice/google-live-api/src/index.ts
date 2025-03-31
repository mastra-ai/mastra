import type { LiveServerMessage, Session } from '@google/genai';
import { GoogleGenAI, Modality } from '@google/genai';
import { MastraVoice } from '@mastra/core/voice';

type VoiceEventType = 'speaking' | 'writing' | 'error';

type EventCallback = (...args: any[]) => void;

type EventMap = {
  [K in VoiceEventType]: EventCallback[];
} & {
  [key: string]: EventCallback[];
};

const DEFAULT_VOICE = 'Puck';

const DEFAULT_MODEL = 'gemini-2.0-flash-exp';

const VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'];

export class GoogleLiveAPI extends MastraVoice {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private state: 'close' | 'open' = 'close';
  private events: EventMap = {} as EventMap;
  private emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;

    for (const callback of this.events[event]) {
      callback(...args);
    }
  }

  constructor({
    chatModel,
    speaker,
  }: {
    chatModel?: {
      model?: string;
      apiKey?: string;
    };
    speaker?: string;
  } = {}) {
    super();
    this.ai = new GoogleGenAI({
      apiKey: chatModel?.apiKey || process.env.GOOGLE_API_KEY,
      apiVersion: 'v1alpha',
    });
  }

  getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return Promise.resolve(VOICES.map(v => ({ voiceId: v })));
  }

  close() {
    if (!this.session) return;
    this.session.close();
    this.session = null;
  }

  async speak(input: string | NodeJS.ReadableStream): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected. Call connect() first');
    }
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      input = Buffer.concat(chunks).toString('base64');
    }

    if (input.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    this.session.sendClientContent({
      turns: {
        role: 'user',
        parts: [
          {
            text: `Repeat after me: "${input}"`,
          },
        ],
      },
      turnComplete: true,
    });
  }

  async connect(options?: { speaker?: string }): Promise<void> {
    try {
      this.session = await this.ai.live.connect({
        model: DEFAULT_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: options?.speaker || DEFAULT_VOICE,
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            this.state = 'open';
            //console.log('Connection opened');
            this.emit('connection', { status: 'Connected' });
          },
          onclose: () => {
            this.state = 'close';
            this.emit('connection', { status: 'Closed' });
          },
          onerror: e => {
            console.error('Error:', e);
            this.emit('error', e);
          },
          onmessage: (e: LiveServerMessage) => {
            //console.log('Message:', e);
            this.handleMessage(e);
          },
        },
      });
      this.state = 'open';
    } catch (e) {
      this.state = 'close';
      console.error('Connection error:', e);
      this.emit('error', e);
      throw e;
    }
  }

  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(callback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
    }
  }
  private handleMessage(e: LiveServerMessage): void {
    if (e.serverContent?.turnComplete === true) {
      this.emit('speaking:completed', { status: 'Speaking completed' });
    }
    if (e.serverContent?.modelTurn) {
      // Handle text content
      e.serverContent.modelTurn.parts?.forEach(part => {
        if (part.text) {
          this.emit('writing', { text: part.text });
        }

        // Handle audio data
        if (part.inlineData?.data) {
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          this.emit('speaking', { audioBuffer: audioBuffer });
        }
      });
    }
    if (e.serverContent?.turnComplete === true) {
      this.emit('conversation.completed', { status: 'completed' });
    }
  }
  listen(
    audioStream: NodeJS.ReadableStream | unknown,
    options?: unknown,
  ): Promise<string | NodeJS.ReadableStream | void> {
    throw new Error('Method not implemented.');
  }
}
