/**
 * Skills Demo
 *
 * This script demonstrates how to use the Skills class with an agent
 * that activates skills on-demand for domain-specific tasks.
 *
 * Run with: pnpm demo:skills
 */

import { skills, mastra } from './mastra/index';

async function main() {
  console.log('='.repeat(60));
  console.log('MASTRA SKILLS DEMO');
  console.log('='.repeat(60));
  console.log();

  // Step 1: List available skills
  console.log('1. Available skills:');
  console.log('-'.repeat(40));

  const availableSkills = skills.list();
  for (const skill of availableSkills) {
    console.log(`  - ${skill.name}: ${skill.description?.slice(0, 60)}...`);
  }
  console.log();

  // Step 2: Get a specific skill
  console.log('2. Getting brand-guidelines skill details:');
  console.log('-'.repeat(40));

  const brandSkill = skills.get('brand-guidelines');
  if (brandSkill) {
    console.log(`  Name: ${brandSkill.name}`);
    console.log(`  License: ${brandSkill.license}`);
    console.log(`  Instructions length: ${brandSkill.instructions.length} chars`);
    console.log(`  References: ${brandSkill.references.join(', ') || 'none'}`);
  }
  console.log();

  // Step 3: Search skills content
  console.log('3. Searching skills for "brand colors":');
  console.log('-'.repeat(40));

  const searchResults = await skills.search('brand colors', { topK: 3 });
  for (const result of searchResults) {
    console.log(`  - [${result.skillName}] ${result.source}`);
    console.log(`    Score: ${result.score.toFixed(3)}`);
    console.log(`    Lines: ${result.lineRange?.start}-${result.lineRange?.end}`);
  }
  console.log();

  // Step 4: Test the docs agent with skills
  console.log('4. Testing docs agent with skills activation:');
  console.log('-'.repeat(40));

  const agent = mastra.getAgent('docsAgent');

  const prompts = [
    'Write a short description of Mastra agents following the brand guidelines.',
    'What are the primary brand colors for Mastra in dark mode?',
  ];

  for (const prompt of prompts) {
    console.log(`\nUser: ${prompt}`);
    console.log();

    const response = await agent.generate(prompt);

    console.log(`Agent: ${response.text}`);
    console.log();
    console.log('-'.repeat(40));
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Skills demo complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
