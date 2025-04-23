import { createReadStream } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { GoogleVision } from './index';
import 'dotenv/config';

describe('Google Vision Integration Tests', () => {
  const vision = new GoogleVision({
    visionModel: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
  });
  it('should answer video from fixture file', async () => {
    const fixturePath = path.join(process.cwd(), '__fixtures__', 'demo.mp4');

    const videoStream = createReadStream(fixturePath);
    const text = await vision.analyze(
      videoStream,
      `What I said in this video, and also tell my jacket's color. Answer it under 2-3 lines`,
    );

    for await (const chunk of text) {
      console.log(chunk.toString());
    }

    expect(text).toBeTruthy();
    //expect(typeof text).toBe('string');
    //expect(text.length).toBeGreaterThan(0);
  }, 15000);
});
