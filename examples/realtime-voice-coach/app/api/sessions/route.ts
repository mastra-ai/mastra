import axios from 'axios';

const baseUrl = 'https://api.openai.com/v1';

const api = axios.create({
  baseURL: baseUrl,
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const POST = async (request: Request) => {
  const data = await request.json();
  const session = await createSession(data);
  return new Response(JSON.stringify(session));
};

async function createSession({ model, voice }: { model?: string; voice?: string }) {
  const r = await api.post('/realtime/sessions', {
    model: model || process.env.OPENAI_API_REALTIME_MODEL,
    voice: voice || process.env.OPENAI_API_REALTIME_VOICE,
  });

  return r.data;
}
