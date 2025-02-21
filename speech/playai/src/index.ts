import { MastraTTS } from '@mastra/core/tts';

interface PlayAIVoice {
  name: string;
  accent: string;
  gender: 'M' | 'F';
  age: 'Young' | 'Middle' | 'Old';
  style: 'Conversational' | 'Narrative';
  id: string;
}

export const PLAYAI_VOICES: PlayAIVoice[] = [
  {
    name: 'Angelo',
    accent: 'US',
    gender: 'M',
    age: 'Young',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json',
  },
  {
    name: 'Arsenio',
    accent: 'US African American',
    gender: 'M',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/65977f5e-a22a-4b36-861b-ecede19bdd65/original/manifest.json',
  },
  {
    name: 'Cillian',
    accent: 'Irish',
    gender: 'M',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/1591b954-8760-41a9-bc58-9176a68c5726/original/manifest.json',
  },
  {
    name: 'Timo',
    accent: 'US',
    gender: 'M',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/677a4ae3-252f-476e-85ce-eeed68e85951/original/manifest.json',
  },
  {
    name: 'Dexter',
    accent: 'US',
    gender: 'M',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/b27bc13e-996f-4841-b584-4d35801aea98/original/manifest.json',
  },
  {
    name: 'Miles',
    accent: 'US African American',
    gender: 'M',
    age: 'Young',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/29dd9a52-bd32-4a6e-bff1-bbb98dcc286a/original/manifest.json',
  },
  {
    name: 'Briggs',
    accent: 'US Southern (Oklahoma)',
    gender: 'M',
    age: 'Old',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/71cdb799-1e03-41c6-8a05-f7cd55134b0b/original/manifest.json',
  },
  {
    name: 'Deedee',
    accent: 'US African American',
    gender: 'F',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/e040bd1b-f190-4bdb-83f0-75ef85b18f84/original/manifest.json',
  },
  {
    name: 'Nia',
    accent: 'US',
    gender: 'F',
    age: 'Young',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/831bd330-85c6-4333-b2b4-10c476ea3491/original/manifest.json',
  },
  {
    name: 'Inara',
    accent: 'US African American',
    gender: 'F',
    age: 'Middle',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/adb83b67-8d75-48ff-ad4d-a0840d231ef1/original/manifest.json',
  },
  {
    name: 'Constanza',
    accent: 'US Latin American',
    gender: 'F',
    age: 'Young',
    style: 'Conversational',
    id: 's3://voice-cloning-zero-shot/b0aca4d7-1738-4848-a80b-307ac44a7298/original/manifest.json',
  },
  {
    name: 'Gideon',
    accent: 'British',
    gender: 'M',
    age: 'Old',
    style: 'Narrative',
    id: 's3://voice-cloning-zero-shot/5a3a1168-7793-4b2c-8f90-aff2b5232131/original/manifest.json',
  },
  {
    name: 'Casper',
    accent: 'US',
    gender: 'M',
    age: 'Middle',
    style: 'Narrative',
    id: 's3://voice-cloning-zero-shot/1bbc6986-fadf-4bd8-98aa-b86fed0476e9/original/manifest.json',
  },
  {
    name: 'Mitch',
    accent: 'Australian',
    gender: 'M',
    age: 'Middle',
    style: 'Narrative',
    id: 's3://voice-cloning-zero-shot/c14e50f2-c5e3-47d1-8c45-fa4b67803d19/original/manifest.json',
  },
  {
    name: 'Ava',
    accent: 'Australian',
    gender: 'F',
    age: 'Middle',
    style: 'Narrative',
    id: 's3://voice-cloning-zero-shot/50381567-ff7b-46d2-bfdc-a9584a85e08d/original/manifest.json',
  },
];

interface PlayAITTSConfig {
  name: 'PlayDialog' | 'Play3.0-mini';
  apiKey?: string;
}

interface PlayAIJobResponse {
  id: string;
  createdAt: string;
  input: {
    model: string;
    text: string;
    voice: string;
  };
  completedAt: string;
  output: {
    status: string;
    url: string;
    contentType: string;
    fileSize: number;
    duration: number;
  };
}

export class PlayAITTS extends MastraTTS {
  private baseUrl = 'https://api.play.ai/api/v1';
  private userId: string;
  constructor({ model, userId }: { model: PlayAITTSConfig; userId: string }) {
    super({
      model: {
        provider: 'PLAYAI',
        ...model,
      },
    });
    this.userId = userId;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${process.env.PLAYAI_API_KEY || this.model.apiKey}`,
      'Content-Type': 'application/json',
      'X-USER-ID': this.userId,
    };
  }

  private async makeRequest(endpoint: string, payload?: any, method: 'GET' | 'POST' = 'POST') {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json()) as { message: string };

      throw new Error(`PlayAI API Error: ${error.message || response.statusText}`);
    }

    return response;
  }

  private async pollJobStatus(jobId: string, maxAttempts = 60, interval = 1000): Promise<ArrayBuffer> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.makeRequest(`/tts/${jobId}`, undefined, 'GET');
      const jobStatus = (await response.json()) as PlayAIJobResponse;

      // console.log(jobStatus);

      if (jobStatus.output.status === 'COMPLETED' && jobStatus.output?.url) {
        // Fetch the actual audio file
        const audioResponse = await fetch(jobStatus.output.url);
        if (!audioResponse.ok) {
          throw new Error('Failed to fetch audio file');
        }
        return await audioResponse.arrayBuffer();
      }

      if (jobStatus.output.status === 'FAILED') {
        const errorMessage = 'TTS generation failed';
        const errorType = 'Unknown';
        throw new Error(`PlayAI Error (${errorType}): ${errorMessage}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('TTS generation timed out');
  }

  async generate({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const payload = {
        text,
        voice,
        model: this.model.name,
      };

      const response = await this.makeRequest('/tts', payload);
      const location = response.headers.get('location');

      if (!location) {
        throw new Error('No job location returned from API');
      }

      // Extract the job ID from the location header
      const jobId = location.split('/').pop();

      if (!jobId) {
        throw new Error('Could not parse job ID from location header');
      }

      // Poll the job status and get the final audio
      const audioBuffer = await this.pollJobStatus(jobId);
      return Buffer.from(audioBuffer);
    }, 'tts.playai.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ text, voice }: { text: string; voice?: string }) {
    const audioStream = await this.traced(async () => {
      const payload = {
        text,
        voice,
        model: this.model.name,
      };

      const response = await this.makeRequest('/tts/stream', payload);
      return response.body;
    }, 'tts.playai.stream')();

    return {
      audioResult: audioStream,
    };
  }

  async voices() {
    return this.traced(() => Promise.resolve(PLAYAI_VOICES), 'tts.playai.voices')();
  }
}
