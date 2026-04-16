import { mastra } from './mastra/index.js';

async function main() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const agent = mastra.getAgent('webSearchAgent');

  const stream = await agent.stream(`${today}; What are the latest developments in AI agent frameworks?`);

  for await (const chunk of stream.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        process.stdout.write(chunk.payload.text);
        break;
      case 'tool-call':
        console.log(`\n[tool-call] ${chunk.payload.toolName}(${JSON.stringify(chunk.payload.args, null, 2)})\n`);
        break;
      case 'tool-result':
        console.log(`[tool-result] ${chunk.payload.toolName} → ${JSON.stringify(chunk.payload.result).slice(0, 200)}...\n`);
        break;
    }
  }

  console.log('\n');
}

main().catch(console.error);
