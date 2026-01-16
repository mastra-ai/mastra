/**
 * Workspace API Demo
 *
 * This script focuses on demonstrating the Workspace class API directly:
 * - Filesystem operations
 * - Skills API
 * - Search API
 *
 * Run with: pnpm demo:workspace
 */

import { globalWorkspace } from './mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('WORKSPACE API DEMO');
  console.log('='.repeat(70));
  console.log();

  // Initialize workspace
  console.log('1. Initializing workspace...');
  await globalWorkspace.init();
  console.log(`   Status: ${globalWorkspace.status}`);
  console.log(`   ID: ${globalWorkspace.id}`);
  console.log(`   Name: ${globalWorkspace.name}`);
  console.log();

  // =========================================================================
  // Filesystem API
  // =========================================================================
  console.log('2. Filesystem API:');
  console.log('-'.repeat(40));

  // Check if file exists
  const skillsExists = await globalWorkspace.exists('/skills');
  console.log(`   /skills exists: ${skillsExists}`);

  // List directory
  const entries = await globalWorkspace.readdir('/');
  console.log(`   Root directory contents:`);
  for (const entry of entries.slice(0, 5)) {
    console.log(`     ${entry.type === 'directory' ? '📁' : '📄'} ${entry.name}`);
  }
  if (entries.length > 5) {
    console.log(`     ... and ${entries.length - 5} more`);
  }
  console.log();

  // =========================================================================
  // Skills API
  // =========================================================================
  console.log('3. Skills API:');
  console.log('-'.repeat(40));

  if (globalWorkspace.skills) {
    // List skills
    const skills = await globalWorkspace.skills.list();
    console.log(`   Found ${skills.length} skills:`);
    for (const skill of skills) {
      console.log(`     - ${skill.name}`);
    }
    console.log();

    // Get specific skill
    if (skills.length > 0) {
      const firstSkill = await globalWorkspace.skills.get(skills[0].name);
      if (firstSkill) {
        console.log(`   Details for "${firstSkill.name}":`);
        console.log(`     Description: ${firstSkill.description?.slice(0, 50) || 'N/A'}...`);
        console.log(`     Instructions length: ${firstSkill.instructions.length} chars`);
        console.log(`     Allowed tools: ${firstSkill.allowedTools?.length || 0}`);
      }
    }
    console.log();

    // Search skills
    console.log('   Searching skills for "api":');
    const searchResults = await globalWorkspace.skills.search('api', { topK: 3 });
    for (const result of searchResults) {
      console.log(`     - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
  } else {
    console.log('   Skills not configured.');
  }
  console.log();

  // =========================================================================
  // Search API
  // =========================================================================
  console.log('4. Search API:');
  console.log('-'.repeat(40));
  console.log(`   BM25 enabled: ${globalWorkspace.canBM25}`);
  console.log(`   Vector enabled: ${globalWorkspace.canVector}`);
  console.log(`   Hybrid enabled: ${globalWorkspace.canHybrid}`);

  if (globalWorkspace.canBM25) {
    // Index some content
    console.log();
    console.log('   Indexing sample content...');
    await globalWorkspace.index('/sample/doc1.txt', 'This is a sample document about TypeScript programming.');
    await globalWorkspace.index('/sample/doc2.txt', 'Guide to building REST APIs with Node.js and Express.');
    await globalWorkspace.index('/sample/doc3.txt', 'Best practices for code review in software development.');

    // Search
    console.log('   Searching for "TypeScript":');
    const results = await globalWorkspace.search('TypeScript', { topK: 2 });
    for (const result of results) {
      console.log(`     - [${result.id}] score: ${result.score.toFixed(3)}`);
    }

    // Clean up
    await globalWorkspace.unindex('/sample/doc1.txt');
    await globalWorkspace.unindex('/sample/doc2.txt');
    await globalWorkspace.unindex('/sample/doc3.txt');
  }
  console.log();

  // =========================================================================
  // Workspace Info
  // =========================================================================
  console.log('5. Workspace Info:');
  console.log('-'.repeat(40));
  const info = await globalWorkspace.getInfo();
  console.log(`   ID: ${info.id}`);
  console.log(`   Name: ${info.name}`);
  console.log(`   Status: ${info.status}`);
  console.log(`   Filesystem: ${info.filesystem?.provider || 'None'}`);
  console.log(`   Total files: ${info.filesystem?.totalFiles ?? 'N/A'}`);
  console.log();

  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
