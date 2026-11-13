import { MastraClient } from '@mastra/client-js';
import { z } from 'zod';

const modelSchema = z.object({ id: z.string() });
const gatewayAudioModelsSchema = z.object({
  speech: z.array(modelSchema.extend({ voices: z.array(z.string()) })),
  transcription: z.array(modelSchema),
});

export type GatewayAudioModels = z.infer<typeof gatewayAudioModelsSchema>;

function gatewayClient(baseUrl: string) {
  return new MastraClient({ baseUrl, credentials: 'include', retries: 0 });
}

export async function listGatewayAudioModels(baseUrl: string): Promise<GatewayAudioModels> {
  const models = await gatewayClient(baseUrl).request<unknown>('/system/gateway-audio/models');
  return gatewayAudioModelsSchema.parse(models);
}

export async function transcribeGatewayAudio(
  baseUrl: string,
  model: string,
  audio: Blob,
  extension: string,
): Promise<string> {
  const form = new FormData();
  form.set('model', model);
  form.set('file', new File([audio], `dictation.${extension}`, { type: audio.type }));
  const result = await gatewayClient(baseUrl).request<unknown>('/system/gateway-audio/transcriptions', {
    method: 'POST',
    body: form,
  });
  return z.object({ text: z.string() }).parse(result).text;
}

export async function speakGatewayAudio(baseUrl: string, model: string, voice: string, input: string): Promise<Blob> {
  const response = await gatewayClient(baseUrl).request<Response>('/system/gateway-audio/speech', {
    method: 'POST',
    body: { model, voice, input },
    stream: true,
  });
  return response.blob();
}
