#!/usr/bin/env -S npx tsx
/**
 * AgentFS Workspace Demo
 *
 * Run with: npx tsx src/demo/index.ts [--type <type>]
 *
 * Types:
 *   filesystem  - Filesystem API (write, read, list, stat, delete)
 *   agents      - Agent with AgentFS workspace
 *   all         - Run all demos (default)
 */

import { mastra, agentfsWorkspace, readonlyWorkspace } from '../mastra';

const args = process.argv.slice(2);
const typeIndex = args.indexOf('--type');
const demoType = typeIndex !== -1 ? args[typeIndex + 1] : 'all';

function header(title: string) {
  console.log();
  console.log('='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  console.log();
}

function section(title: string) {
  console.log('-'.repeat(40));
  console.log(title);
  console.log('-'.repeat(40));
}

// =============================================================================
// FILESYSTEM DEMO
// =============================================================================
async function demoFilesystem() {
  header('AGENTFS FILESYSTEM DEMO');

  await agentfsWorkspace.init();

  const fs = agentfsWorkspace.filesystem!;

  // Write files
  section('Write Files');
  await fs.mkdir('/notes/dev');
  await fs.writeFile('/notes/dev/todo.md', '# TODO\n\n- [ ] Ship the thing\n- [ ] Write tests\n');
  await fs.writeFile('/notes/dev/ideas.md', '# Ideas\n\n- AgentFS is cool\n');
  await fs.writeFile('/data.json', JSON.stringify({ created: new Date().toISOString() }, null, 2));
  console.log('  Wrote /notes/dev/todo.md');
  console.log('  Wrote /notes/dev/ideas.md');
  console.log('  Wrote /data.json');
  console.log();

  // List directory
  section('List Directory');
  const entries = await fs.readdir('/notes/dev');
  for (const entry of entries) {
    const icon = entry.type === 'directory' ? 'dir' : 'file';
    console.log(`  [${icon}] ${entry.name} (${entry.size} bytes)`);
  }
  console.log();

  // Read file
  section('Read File');
  const content = await fs.readFile('/notes/dev/todo.md', { encoding: 'utf-8' });
  console.log(content);

  // Stat
  section('Stat');
  const stat = await fs.stat('/notes/dev/todo.md');
  console.log(`  name: ${stat.name}`);
  console.log(`  path: ${stat.path}`);
  console.log(`  type: ${stat.type}`);
  console.log(`  size: ${stat.size}`);
  console.log(`  modified: ${stat.modifiedAt.toISOString()}`);
  console.log();

  // Append
  section('Append');
  await fs.appendFile('/notes/dev/todo.md', '- [ ] Profit\n');
  const updated = await fs.readFile('/notes/dev/todo.md', { encoding: 'utf-8' });
  console.log(updated);

  // Copy and move
  section('Copy & Move');
  await fs.copyFile('/notes/dev/todo.md', '/notes/dev/todo-backup.md');
  console.log('  Copied todo.md -> todo-backup.md');
  await fs.moveFile('/notes/dev/ideas.md', '/notes/dev/archived-ideas.md');
  console.log('  Moved ideas.md -> archived-ideas.md');
  console.log();

  // Verify
  const afterMove = await fs.readdir('/notes/dev');
  console.log('  Directory after copy & move:');
  for (const entry of afterMove) {
    console.log(`    ${entry.name}`);
  }
  console.log();

  // Read-only demo
  section('Read-Only Filesystem');
  await readonlyWorkspace.init();
  try {
    await readonlyWorkspace.filesystem!.writeFile('/nope.txt', 'should fail');
    console.log('  ERROR: Write should have been blocked!');
  } catch (error) {
    console.log(`  Write blocked: ${(error as Error).message}`);
  }
  console.log();

  // Cleanup
  section('Cleanup');
  await fs.rmdir('/notes', { recursive: true });
  await fs.deleteFile('/data.json');
  console.log('  Cleaned up test files');

  await agentfsWorkspace.destroy();
  await readonlyWorkspace.destroy();
}

// =============================================================================
// AGENTS DEMO
// =============================================================================
async function demoAgents() {
  header('AGENT WITH AGENTFS DEMO');

  const agent = mastra.getAgent('notesAgent');

  // Init the agent's workspace (not automatic)
  const agentWorkspace = await agent.getWorkspace();
  if (agentWorkspace) {
    await agentWorkspace.init();
  }

  // Show available tools
  section('Agent Tools');
  const tools = await agent.listTools();
  const wsTools = Object.keys(tools).filter(t => t.startsWith('mastra_workspace'));
  console.log(`  Workspace tools: ${wsTools.length}`);
  for (const tool of wsTools) {
    console.log(`    - ${tool}`);
  }
  console.log();

  // Workspace info
  section('Workspace Info');
  if (agentWorkspace) {
    const info = await agentWorkspace.getInfo();
    console.log(`  ID: ${info.id}`);
    console.log(`  Name: ${info.name}`);
    console.log(`  Filesystem: ${info.filesystem?.provider}`);
    console.log(`  Status: ${info.status}`);
  }
  console.log();

  // Generate with the agent (requires OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    section('Agent Generation');
    console.log('  Asking agent to save a note...');
    const response = await agent.generate(
      'Save a note about AgentFS: it stores files in SQLite, persists across sessions, and works with the Mastra workspace API.',
    );
    console.log(`  Response: ${response.text.slice(0, 200)}...`);
  } else {
    section('Agent Generation (skipped)');
    console.log('  Set OPENAI_API_KEY to run the agent generation demo');
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('AgentFS Workspace Demo');
  console.log(`  Demo type: ${demoType}`);

  const demos: Record<string, () => Promise<void>> = {
    filesystem: demoFilesystem,
    agents: demoAgents,
  };

  if (demoType === 'all') {
    for (const fn of Object.values(demos)) {
      await fn();
    }
  } else if (demos[demoType]) {
    await demos[demoType]();
  } else {
    console.error(`Unknown demo type: ${demoType}`);
    console.error('Available: filesystem, agents, all');
    process.exit(1);
  }

  header('DEMO COMPLETE');
}

main().catch(console.error);
