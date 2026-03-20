import { MastraClient, type CreateResponseParams } from '@mastra/client-js';

const DEFAULT_AGENT_ID = process.env.MASTRA_AGENT_ID ?? 'support-agent';
const AGENT_BACKED_EXAMPLE = 'agent-memory';
const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_BASE_URL ?? 'http://localhost:4111',
});

type DemoRequestBody = CreateResponseParams & {
  example?: unknown;
};

function normalizeDemoRequest(body: DemoRequestBody) {
  const requestBody = { ...body };
  delete requestBody.example;

  if ((body.example === AGENT_BACKED_EXAMPLE || body.store === true) && requestBody.agent_id == null) {
    requestBody.agent_id = DEFAULT_AGENT_ID;
  }

  if (typeof requestBody.agent_id === 'string' && requestBody.agent_id.includes('/')) {
    throw new Error(
      `Invalid agent_id "${requestBody.agent_id}". Use a registered Mastra agent ID such as "${DEFAULT_AGENT_ID}", not a model string like "openai/gpt-4.1-mini".`,
    );
  }

  return requestBody;
}

export async function POST(request: Request) {
  try {
    const body = normalizeDemoRequest((await request.json()) as DemoRequestBody);

    if (body.stream === true) {
      const streamResponseBody: CreateResponseParams & { stream: true } = { ...body, stream: true };
      console.log({streamResponseBody})
      const stream = await mastraClient.responses.create(streamResponseBody);
      return stream.asResponse();
    }

    const createResponseBody: CreateResponseParams & { stream?: false } = { ...body, stream: false };
    console.log({createResponseBody})
    const response = await mastraClient.responses.create(createResponseBody);

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
