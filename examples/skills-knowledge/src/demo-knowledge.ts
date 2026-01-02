/**
 * Knowledge Demo
 *
 * This script demonstrates how to use the Knowledge class with a support agent
 * that retrieves relevant FAQ documents using BM25 search.
 *
 * Run with: pnpm demo:knowledge
 */

import { supportKnowledge } from './mastra/knowledge/index';
import { mastra } from './mastra/index';

async function main() {
  console.log('='.repeat(60));
  console.log('MASTRA KNOWLEDGE DEMO');
  console.log('='.repeat(60));
  console.log();

  // Note: Knowledge documents are pre-populated in .mastra-knowledge/
  // No initialization needed - they're loaded from disk automatically

  // Step 1: Test direct search on the knowledge base
  console.log('1. Testing direct BM25 search...');
  console.log('-'.repeat(40));

  const searchQueries = ['reset password', 'billing cycle', 'API rate limits'];

  for (const query of searchQueries) {
    console.log(`\nQuery: "${query}"`);
    const results = await supportKnowledge.search('default', query, {
      topK: 2,
      mode: 'bm25',
    });

    for (const result of results) {
      console.log(`  - [${result.key}] score: ${result.score.toFixed(3)}`);
      console.log(`    ${result.content.slice(0, 80)}...`);
    }
  }
  console.log();

  // Step 2: Test the support agent with knowledge retrieval
  console.log('2. Testing support agent with knowledge retrieval...');
  console.log('-'.repeat(40));

  const agent = mastra.getAgent('supportAgent');

  const questions = [
    'How do I reset my password?',
    "What's your refund policy?",
    'What are the API rate limits for the Pro plan?',
  ];

  for (const question of questions) {
    console.log(`\nUser: ${question}`);
    console.log();

    const response = await agent.generate(question);

    console.log(`Agent: ${response.text}`);
    console.log();
    console.log('-'.repeat(40));
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Knowledge demo complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
