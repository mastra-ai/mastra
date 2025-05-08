// ping the deployed mastra agent to keep it warm

export async function GET() {
  const mastraAgentUrl = process.env.MASTRA_AGENT_URL;
  if (!mastraAgentUrl) {
    return new Response("MASTRA_AGENT_URL is not set", { status: 500 });
  }
  const response = await fetch(`${mastraAgentUrl}/api/agents`);
  if (!response.ok) {
    return new Response("Failed to ping mastra agent", { status: 500 });
  }
  return new Response("Pong");
}
