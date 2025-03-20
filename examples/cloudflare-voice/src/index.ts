import { CloudflareVoice } from '@mastra/voice-cloudflare';
import type { Ai } from '@cloudflare/workers-types';

export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ai') {
      const voice = new CloudflareVoice({
        binding: env.AI,
        listeningModel: {
          model: '@cf/openai/whisper-large-v3-turbo',
        },
      });
      const audioStream = await env.ASSETS.fetch(new URL('/voice-test.m4a', request.url));

      const text = await voice.listen(audioStream.body);
      console.log(text);

      return new Response(text);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
