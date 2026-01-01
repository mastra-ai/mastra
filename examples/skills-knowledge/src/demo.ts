/**
 * Skills + Knowledge Combined Demo
 *
 * This script demonstrates both Skills and Knowledge primitives working together.
 *
 * Run with: pnpm demo
 */

import { skills, mastra } from './mastra/index';
import { initializeSupportKnowledge, supportKnowledge } from './mastra/knowledge/index';

async function main() {
  console.log('='.repeat(70));
  console.log('MASTRA SKILLS + KNOWLEDGE DEMO');
  console.log('='.repeat(70));
  console.log();
  console.log('This demo shows how Skills and Knowledge work together in Mastra.');
  console.log();
  console.log('- Skills: Domain-specific instructions activated on-demand (tool-based)');
  console.log('- Knowledge: Factual content retrieved dynamically (processor-based)');
  console.log();

  // Initialize knowledge base
  console.log('Initializing knowledge base...');
  await initializeSupportKnowledge();
  console.log();

  // =========================================================================
  // PART 1: Skills
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: SKILLS');
  console.log('='.repeat(70));
  console.log();
  console.log('Skills are discovered from SKILL.md files. The agent activates them');
  console.log('using tools when it needs domain-specific guidance.');
  console.log();

  console.log('Available skills:');
  for (const skill of skills.list()) {
    console.log(`  - ${skill.name}`);
  }
  console.log();

  console.log('Searching skills for "writing style":');
  const skillResults = await skills.search('writing style', { topK: 2 });
  for (const result of skillResults) {
    console.log(`  - [${result.skillName}] line ${result.lineRange?.start}: ${result.content.slice(0, 50)}...`);
  }
  console.log();

  // =========================================================================
  // PART 2: Knowledge
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: KNOWLEDGE');
  console.log('='.repeat(70));
  console.log();
  console.log('Knowledge contains factual content (FAQs, docs, etc.) that is');
  console.log('automatically retrieved based on user queries.');
  console.log();

  console.log('Searching knowledge for "refund":');
  const knowledgeResults = await supportKnowledge.search('default', 'refund', { topK: 2 });
  for (const result of knowledgeResults) {
    console.log(`  - [${result.key}] score: ${result.score.toFixed(3)}`);
    console.log(`    ${result.content.slice(0, 60)}...`);
  }
  console.log();

  // =========================================================================
  // PART 3: Agents in Action
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: AGENTS IN ACTION');
  console.log('='.repeat(70));
  console.log();

  // Docs Agent (Skills)
  console.log('--- Docs Agent (uses Skills) ---');
  console.log();
  const docsAgent = mastra.getAgent('docsAgent');
  const docsPrompt = 'Write a one-sentence technical description of what Mastra workflows do.';
  console.log(`User: ${docsPrompt}`);
  const docsResponse = await docsAgent.generate(docsPrompt);
  console.log(`Agent: ${docsResponse.text}`);
  console.log();

  // Support Agent (Knowledge)
  console.log('--- Support Agent (uses Knowledge) ---');
  console.log();
  const supportAgent = mastra.getAgent('supportAgent');
  const supportPrompt = 'How do I reset my password?';
  console.log(`User: ${supportPrompt}`);
  const supportResponse = await supportAgent.generate(supportPrompt);
  console.log(`Agent: ${supportResponse.text}`);
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Skills vs Knowledge:');
  console.log('');
  console.log('| Aspect          | Skills                  | Knowledge             |');
  console.log('|-----------------|-------------------------|------------------------|');
  console.log('| Content         | SKILL.md files          | Arbitrary documents    |');
  console.log('| Retrieval       | Tool-based (on-demand)  | Processor (auto)       |');
  console.log('| Use case        | Domain expertise        | Factual content        |');
  console.log('| Example         | Brand guidelines        | FAQ documents          |');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
