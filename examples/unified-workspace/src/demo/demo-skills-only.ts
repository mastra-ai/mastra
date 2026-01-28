/**
 * Demo: Skills-Only Workspace
 *
 * This demo shows how to use a workspace with ONLY skills - no filesystem or sandbox.
 * Skills are loaded read-only via LocalSkillSource.
 *
 * Run: npx bun src/demo/demo-skills-only.ts
 */

import { skillsOnlyWorkspace } from '../mastra';
import { skillsOnlyAgent } from '../mastra/agents/skills-only-agent';

async function main() {
  console.log('='.repeat(60));
  console.log('Skills-Only Workspace Demo');
  console.log('='.repeat(60));

  // Check workspace capabilities
  console.log('\n📋 Workspace Capabilities:');
  console.log(`  - Has filesystem: ${skillsOnlyWorkspace.filesystem !== undefined}`);
  console.log(`  - Has sandbox: ${skillsOnlyWorkspace.sandbox !== undefined}`);
  console.log(`  - Has skills: ${skillsOnlyWorkspace.skills !== undefined}`);
  console.log(`  - Skills writable: ${skillsOnlyWorkspace.skills?.isWritable ?? 'N/A'}`);

  // List available skills
  console.log('\n📚 Available Skills:');
  const skills = await skillsOnlyWorkspace.skills?.list();
  if (skills && skills.length > 0) {
    for (const skill of skills) {
      console.log(`  - ${skill.name}: ${skill.description}`);
    }
  } else {
    console.log('  (No skills found)');
  }

  // Get a specific skill
  console.log('\n🔍 Getting "code-review" skill:');
  const codeReviewSkill = await skillsOnlyWorkspace.skills?.get('code-review');
  if (codeReviewSkill) {
    console.log(`  Name: ${codeReviewSkill.name}`);
    console.log(`  Description: ${codeReviewSkill.description}`);
    console.log(`  Path: ${codeReviewSkill.path}`);
    console.log(`  Instructions preview: ${codeReviewSkill.instructions.slice(0, 100)}...`);
  } else {
    console.log('  (Skill not found)');
  }

  // Search skills
  console.log('\n🔎 Searching skills for "API":');
  const searchResults = await skillsOnlyWorkspace.skills?.search('API');
  if (searchResults && searchResults.length > 0) {
    for (const result of searchResults.slice(0, 3)) {
      console.log(`  - ${result.skillName} (score: ${result.score.toFixed(2)})`);
      console.log(`    ${result.content.slice(0, 80)}...`);
    }
  } else {
    console.log('  (No results)');
  }

  // Demonstrate that CRUD operations fail (read-only)
  console.log('\n🚫 Testing CRUD operations (should fail - read-only):');
  try {
    await skillsOnlyWorkspace.skills?.create({
      metadata: { name: 'test-skill', description: 'Test' },
      instructions: 'Test instructions',
    });
    console.log('  ERROR: Create should have failed!');
  } catch (error) {
    console.log(`  ✓ Create failed as expected: ${(error as Error).message}`);
  }

  // Use the agent to ask about skills
  console.log('\n🤖 Testing Skills-Only Agent:');
  console.log('  (Agent has skills but no filesystem/sandbox tools)');

  // Show the agent's available tools
  const tools = await skillsOnlyAgent.listTools();
  console.log(`\n  Available tools (${Object.keys(tools).length}):`);
  for (const toolName of Object.keys(tools).slice(0, 10)) {
    console.log(`    - ${toolName}`);
  }
  if (Object.keys(tools).length > 10) {
    console.log(`    ... and ${Object.keys(tools).length - 10} more`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
