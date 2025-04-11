const baseUrl = 'https://api.openai.com/v1';

export const POST = async (request: Request) => {
  const data = await request.json();
  const session = await createSession(data);
  return new Response(JSON.stringify(session));
};

export async function createSession({ model, voice }: { model?: string; voice?: string }) {
  const r = await fetch(`${baseUrl}/realtime/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_API_REALTIME_MODEL,
      voice: voice || process.env.OPENAI_API_REALTIME_VOICE,
    }),
  });

  return r.json();
}
