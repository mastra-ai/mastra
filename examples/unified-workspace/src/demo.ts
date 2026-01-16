/**
 * Unified Workspace Demo
 *
 * This script demonstrates the unified Workspace API that combines:
 * - Filesystem access
 * - Skills discovery and search
 * - BM25 content search
 * - Agent workspace inheritance
 *
 * Run with: pnpm demo
 */

import { mastra } from './mastra';
import { globalWorkspace, docsAgentWorkspace } from './mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('MASTRA UNIFIED WORKSPACE DEMO');
  console.log('='.repeat(70));
  console.log();
  console.log('This demo shows the unified Workspace API that combines:');
  console.log('- Filesystem: Read/write files in a structured workspace');
  console.log('- Skills: Discover and search SKILL.md files');
  console.log('- Search: BM25 keyword search across indexed content');
  console.log('- Inheritance: Agents can inherit global skills + add their own');
  console.log();

  // Initialize workspaces (required for skills and search)
  console.log('Initializing workspaces...');
  await globalWorkspace.init();
  console.log();

  // =========================================================================
  // PART 1: Filesystem
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: FILESYSTEM');
  console.log('='.repeat(70));
  console.log();

  console.log('Listing files in /skills directory:');
  const skillFiles = await globalWorkspace.readdir('/skills');
  for (const entry of skillFiles) {
    console.log(`  ${entry.type === 'directory' ? '[DIR]' : '[FILE]'} ${entry.name}`);
  }
  console.log();

  // =========================================================================
  // PART 2: Global vs Agent Skills
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: GLOBAL VS AGENT WORKSPACE SKILLS');
  console.log('='.repeat(70));
  console.log();

  // Global workspace skills
  console.log('Global Workspace Skills (skillsPaths: ["/skills"]):');
  if (globalWorkspace.skills) {
    const globalSkills = await globalWorkspace.skills.list();
    for (const skill of globalSkills) {
      console.log(`  - ${skill.name}`);
    }
  }
  console.log();

  // Agent-specific workspace skills (inherits global + adds own)
  console.log('Docs Agent Workspace Skills (skillsPaths: ["/skills", "/docs-skills"]):');
  if (docsAgentWorkspace.skills) {
    const agentSkills = await docsAgentWorkspace.skills.list();
    for (const skill of agentSkills) {
      const isAgentSpecific = skill.name === 'brand-guidelines';
      console.log(`  - ${skill.name}${isAgentSpecific ? ' (agent-specific)' : ' (inherited)'}`);
    }
  }
  console.log();

  // =========================================================================
  // PART 3: Skills Search
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: SKILLS SEARCH');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    console.log('Searching global workspace for "code review":');
    const skillResults = await globalWorkspace.skills.search('code review', { topK: 2 });
    for (const result of skillResults) {
      console.log(`  - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
    console.log();
  }

  if (docsAgentWorkspace.skills) {
    console.log('Searching docs agent workspace for "brand":');
    const agentResults = await docsAgentWorkspace.skills.search('brand', { topK: 2 });
    for (const result of agentResults) {
      console.log(`  - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
    console.log();
  }

  // =========================================================================
  // PART 4: Content Search (BM25)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: CONTENT SEARCH (BM25)');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.canBM25) {
    console.log('Searching workspace for "password reset":');
    const searchResults = await globalWorkspace.search('password reset', { topK: 2 });
    if (searchResults.length > 0) {
      for (const result of searchResults) {
        console.log(`  - [${result.id}] score: ${result.score.toFixed(3)}`);
      }
    } else {
      console.log('  No results found (content may need to be indexed)');
    }
    console.log();
  }

  // =========================================================================
  // PART 5: Agents with Workspace
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 5: AGENTS WITH WORKSPACE');
  console.log('='.repeat(70));
  console.log();

  // Docs Agent (has its own workspace with inherited + agent-specific skills)
  console.log('--- Docs Agent (own workspace with brand-guidelines) ---');
  console.log();
  const docsAgent = mastra.getAgent('docsAgent');
  const docsPrompt = 'Write a one-sentence technical description of what Mastra workflows do.';
  console.log(`User: ${docsPrompt}`);
  const docsResponse = await docsAgent.generate(docsPrompt);
  console.log(`Agent: ${docsResponse.text}`);
  console.log();

  // Developer Agent (uses global workspace)
  console.log('--- Developer Agent (global workspace) ---');
  console.log();
  const devAgent = mastra.getAgent('developerAgent');
  const devPrompt = 'What are the key things to check when reviewing TypeScript code?';
  console.log(`User: ${devPrompt}`);
  const devResponse = await devAgent.generate(devPrompt);
  console.log(`Agent: ${devResponse.text}`);
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Workspace inheritance pattern:');
  console.log('  - Global workspace: /skills (3 skills)');
  console.log('  - Docs agent workspace: /skills + /docs-skills (4 skills)');
  console.log('  - Developer/Support agents: inherit global workspace');
  console.log();
  console.log('Workspace capabilities:');
  console.log(`  - Filesystem: ${globalWorkspace.filesystem ? 'Available' : 'Not configured'}`);
  console.log(`  - BM25 Search: ${globalWorkspace.canBM25 ? 'Enabled' : 'Disabled'}`);
  console.log(`  - Vector Search: ${globalWorkspace.canVector ? 'Enabled' : 'Disabled'}`);
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
