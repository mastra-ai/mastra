import { setTimeout } from 'node:timers/promises';
import { noopObserve } from '@mastra/core/tools';
import { mastra } from '../src/mastra/index.js';
import { docsSearchTool } from '../src/mastra/tools/docs-search-tool.js';

try {
  // Atlas indexes newly inserted documents asynchronously. Use the real tool
  // until the ingested passage is searchable, without replacing vector storage.
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await docsSearchTool.execute!(
      { query: 'How do I give a Mastra agent memory?', topK: 1 },
      { mastra, observe: noopObserve },
    );
    if (result && 'results' in result && result.results.length > 0) {
      console.log(JSON.stringify(result));
      // This dedicated child owns its MongoDB and observability connections.
      process.exit(0);
    }
    await setTimeout(500);
  }
  throw new Error('The ingested documentation was not retrieved');
} catch (error) {
  console.error(error);
  process.exit(1);
}
