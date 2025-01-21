import { searchAndAnswer } from './mastra';

async function main() {
  // Check environment variables
  if (!process.env.NEEDLE_API_KEY || !process.env.NEEDLE_COLLECTION_ID) {
    console.error('Please set NEEDLE_API_KEY and NEEDLE_COLLECTION_ID environment variables');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  // Example query
  const answer = await searchAndAnswer('What do you know about RAG?');

  console.log('Answer:', answer);
}

main().catch(console.error);
