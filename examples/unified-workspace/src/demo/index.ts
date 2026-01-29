#!/usr/bin/env npx tsx
/**
 * Unified Workspace Demo
 *
 * Run with: npx tsx src/demo [--type <type>]
 *
 * Types:
 *   filesystem  - Filesystem API (read, write, list, delete, mkdir)
 *   skills      - Skills API (discovery, search, CRUD, assets)
 *   workspace   - Workspace API (init, info, search/index)
 *   agents      - Agents with workspaces (inheritance, capabilities)
 *   safety      - Safety features (readonly, requireReadBeforeWrite, approval)
 *   dynamic     - Dynamic skills (context-based skill resolution)
 *   all         - Run all demos (default)
 */

import { mastra } from '../mastra';
import {
  globalWorkspace,
  docsAgentWorkspace,
  readonlyWorkspace,
  safeWriteWorkspace,
  skillsOnlyWorkspace,
  dynamicSkillsWorkspace,
} from '../mastra/workspaces';

// Parse CLI args
const args = process.argv.slice(2);
const typeIndex = args.indexOf('--type');
const demoType = typeIndex !== -1 ? args[typeIndex + 1] : 'all';

function header(title: string) {
  console.log();
  console.log('='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
  console.log();
}

function section(title: string) {
  console.log('-'.repeat(50));
  console.log(title);
  console.log('-'.repeat(50));
}

// =============================================================================
// FILESYSTEM DEMO
// =============================================================================
async function demoFilesystem() {
  header('FILESYSTEM DEMO');

  await globalWorkspace.init();

  const fs = globalWorkspace.filesystem;
  if (!fs) {
    console.log('  No filesystem configured');
    return;
  }

  // List directory
  section('List Directory');
  console.log('Listing /skills:');
  const entries = await fs.readdir('/skills');
  for (const entry of entries) {
    const icon = entry.type === 'directory' ? '📁' : '📄';
    console.log(`  ${icon} ${entry.name}`);
  }
  console.log();

  // Check existence
  section('Check Existence');
  const paths = ['/skills', '/package.json', '/nonexistent'];
  for (const path of paths) {
    const exists = await fs.exists(path);
    console.log(`  ${path}: ${exists ? '✓ exists' : '✗ not found'}`);
  }
  console.log();

  // Read file
  section('Read File');
  const content = await fs.readFile('/package.json');
  const pkg = JSON.parse(content.toString());
  console.log(`  Name: ${pkg.name}`);
  console.log(`  Description: ${pkg.description?.slice(0, 50)}...`);
  console.log();

  // Write/delete file
  section('Write and Delete');
  const testFile = '/.demo-test.txt';
  await fs.writeFile(testFile, `Test: ${new Date().toISOString()}`);
  console.log(`  ✓ Wrote ${testFile}`);
  await fs.deleteFile(testFile);
  console.log(`  ✓ Deleted ${testFile}`);
}

// =============================================================================
// SKILLS DEMO
// =============================================================================
async function demoSkills() {
  header('SKILLS DEMO');

  await globalWorkspace.init();
  await docsAgentWorkspace.init();

  // Discovery
  section('Skills Discovery');
  console.log('Global workspace skills:');
  const globalSkills = await globalWorkspace.skills?.list();
  for (const skill of globalSkills || []) {
    console.log(`  - ${skill.name}`);
  }
  console.log();

  console.log('Docs agent workspace (inherits + extends):');
  const docsSkills = await docsAgentWorkspace.skills?.list();
  for (const skill of docsSkills || []) {
    const isAgent = skill.name === 'brand-guidelines';
    console.log(`  - ${skill.name}${isAgent ? ' (agent-specific)' : ''}`);
  }
  console.log();

  // Get skill details
  section('Skill Details');
  const skill = await globalWorkspace.skills?.get('code-review');
  if (skill) {
    console.log(`  Name: ${skill.name}`);
    console.log(`  Description: ${skill.description?.slice(0, 60)}...`);
    console.log(`  Instructions: ${skill.instructions.length} chars`);
  }
  console.log();

  // Search
  section('Skills Search');
  console.log('Searching for "code review":');
  const results = await globalWorkspace.skills?.search('code review', { topK: 3 });
  for (const r of results || []) {
    console.log(`  - [${r.skillName}] score: ${r.score.toFixed(3)}`);
  }
  console.log();

  // CRUD
  section('Skill CRUD');
  const testName = 'demo-test-skill';
  try {
    const created = await globalWorkspace.skills?.create({
      metadata: { name: testName, description: 'Demo test skill' },
      instructions: 'Test instructions.',
    });
    console.log(`  ✓ Created: ${created?.name}`);

    const updated = await globalWorkspace.skills?.update(testName, {
      metadata: { description: 'Updated description' },
    });
    console.log(`  ✓ Updated: ${updated?.description}`);

    await globalWorkspace.skills?.delete(testName);
    console.log(`  ✓ Deleted`);
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
  }
}

// =============================================================================
// WORKSPACE DEMO
// =============================================================================
async function demoWorkspace() {
  header('WORKSPACE API DEMO');

  await globalWorkspace.init();

  // Info
  section('Workspace Info');
  const info = await globalWorkspace.getInfo();
  console.log(`  ID: ${info.id}`);
  console.log(`  Name: ${info.name}`);
  console.log(`  Status: ${info.status}`);
  console.log(`  Filesystem: ${info.filesystem?.provider || 'None'}`);
  console.log();

  // Capabilities
  section('Capabilities');
  console.log(`  Filesystem: ${globalWorkspace.filesystem ? 'Yes' : 'No'}`);
  console.log(`  Sandbox: ${globalWorkspace.sandbox ? 'Yes' : 'No'}`);
  console.log(`  BM25 Search: ${globalWorkspace.canBM25 ? 'Yes' : 'No'}`);
  console.log(`  Vector Search: ${globalWorkspace.canVector ? 'Yes' : 'No'}`);
  console.log(`  Skills: ${globalWorkspace.skills ? 'Yes' : 'No'}`);
  console.log();

  // Search API
  if (globalWorkspace.canBM25) {
    section('Search API (BM25)');
    await globalWorkspace.index('/demo/ts.txt', 'TypeScript is a typed superset of JavaScript.');
    await globalWorkspace.index('/demo/node.txt', 'Node.js is a JavaScript runtime.');
    console.log('  Indexed 2 documents');

    const results = await globalWorkspace.search('JavaScript', { topK: 2 });
    console.log('  Search "JavaScript":');
    for (const r of results) {
      console.log(`    - [${r.id}] score: ${r.score.toFixed(3)}`);
    }
    console.log('  (Index entries persist in memory until workspace is destroyed)');
  }
}

// =============================================================================
// AGENTS DEMO
// =============================================================================
async function demoAgents() {
  header('AGENTS DEMO');

  await globalWorkspace.init();
  await docsAgentWorkspace.init();

  // Workspace inheritance
  section('Workspace Inheritance');
  console.log('Agent configurations:');
  console.log('  - developerAgent: globalWorkspace (full access)');
  console.log('  - docsAgent: docsAgentWorkspace (global + brand-guidelines)');
  console.log('  - researchAgent: readonlyWorkspace (readOnly)');
  console.log('  - editorAgent: safeWriteWorkspace (requireReadBeforeWrite)');
  console.log('  - automationAgent: supervisedSandboxWorkspace (sandbox approval)');
  console.log('  - skillsOnlyAgent: skillsOnlyWorkspace (no fs/sandbox)');
  console.log();

  // Agent tools
  section('Agent Tools');
  const docsAgent = mastra.getAgent('docsAgent');
  const tools = await docsAgent.listTools();
  const toolNames = Object.keys(tools);
  console.log(`  docsAgent has ${toolNames.length} tools`);
  const wsTools = toolNames.filter(t => t.startsWith('workspace_'));
  console.log(`  Workspace tools: ${wsTools.join(', ')}`);
  console.log();

  // Test agent generation
  section('Agent Generation');
  console.log('Testing docsAgent...');
  try {
    const response = await docsAgent.generate('What skills do you have access to?');
    console.log(`  Response: ${response.text.slice(0, 150)}...`);
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
  }
}

// =============================================================================
// SAFETY DEMO
// =============================================================================
async function demoSafety() {
  header('SAFETY FEATURES DEMO');

  // Readonly
  section('Readonly Workspace');
  await readonlyWorkspace.init();
  console.log('  readonlyWorkspace.filesystem.readOnly: true');
  try {
    await readonlyWorkspace.filesystem?.writeFile('/test.txt', 'test');
    console.log('  ERROR: Write should have failed!');
  } catch (error) {
    console.log(`  ✓ Write blocked: ${(error as Error).message.slice(0, 50)}...`);
  }
  console.log();

  // RequireReadBeforeWrite
  section('Require Read Before Write');
  await safeWriteWorkspace.init();
  console.log('  safeWriteWorkspace tools have requireReadBeforeWrite: true');
  console.log('  (Tool-level enforcement - agents must read before write)');
  console.log();

  // Skills-only (no fs/sandbox)
  section('Skills-Only Workspace');
  console.log(`  Has filesystem: ${skillsOnlyWorkspace.filesystem !== undefined}`);
  console.log(`  Has sandbox: ${skillsOnlyWorkspace.sandbox !== undefined}`);
  console.log(`  Has skills: ${skillsOnlyWorkspace.skills !== undefined}`);
  const skills = await skillsOnlyWorkspace.skills?.list();
  console.log(`  Skills available: ${skills?.length || 0}`);
  console.log();

  // Try to create skill in readonly source
  console.log('  Testing CRUD on read-only skill source:');
  try {
    await skillsOnlyWorkspace.skills?.create({
      metadata: { name: 'test', description: 'test' },
      instructions: 'test',
    });
    console.log('  ERROR: Create should have failed!');
  } catch (error) {
    console.log(`  ✓ Create blocked: ${(error as Error).message.slice(0, 50)}...`);
  }
}

// =============================================================================
// DYNAMIC SKILLS DEMO
// =============================================================================
async function demoDynamicSkills() {
  header('DYNAMIC SKILLS DEMO');

  // Initialize workspace
  await dynamicSkillsWorkspace.init();

  // Test 1: Default context (no userRole)
  section('Default Context (no userRole)');
  console.log('  Refreshing skills with no context...');
  await dynamicSkillsWorkspace.skills?.maybeRefresh();
  const defaultSkills = await dynamicSkillsWorkspace.skills?.list();
  console.log(`  Skills count: ${defaultSkills?.length || 0}`);
  for (const skill of defaultSkills || []) {
    console.log(`    - ${skill.name}`);
  }
  console.log();

  // Test 2: Developer context
  section('Developer Context (userRole=developer)');
  console.log('  Refreshing skills with developer context...');
  const devContext = new Map([['userRole', 'developer']]);
  await dynamicSkillsWorkspace.skills?.maybeRefresh({ requestContext: devContext });
  const devSkills = await dynamicSkillsWorkspace.skills?.list();
  console.log(`  Skills count: ${devSkills?.length || 0}`);
  for (const skill of devSkills || []) {
    const isExtra = skill.name === 'brand-guidelines';
    console.log(`    - ${skill.name}${isExtra ? ' (developer-only)' : ''}`);
  }
  console.log();

  // Test 3: Path context (provider-supplied instructions)
  section('Path Context (Provider Instructions)');
  const ctx = dynamicSkillsWorkspace.getPathContext();
  console.log(`  filesystem.provider: ${ctx.filesystem?.provider}`);
  console.log(`  sandbox: ${ctx.sandbox ? 'configured' : 'not configured'}`);
  console.log(`  instructions: ${ctx.instructions.slice(0, 70)}...`);
  console.log();

  await dynamicSkillsWorkspace.destroy();
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    UNIFIED WORKSPACE DEMO                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Demo type: ${demoType}`);

  const demos: Record<string, () => Promise<void>> = {
    filesystem: demoFilesystem,
    skills: demoSkills,
    workspace: demoWorkspace,
    agents: demoAgents,
    safety: demoSafety,
    dynamic: demoDynamicSkills,
  };

  if (demoType === 'all') {
    for (const [name, fn] of Object.entries(demos)) {
      await fn();
    }
  } else if (demos[demoType]) {
    await demos[demoType]();
  } else {
    console.error(`Unknown demo type: ${demoType}`);
    console.error('Available: filesystem, skills, workspace, agents, safety, all');
    process.exit(1);
  }

  header('DEMO COMPLETE');
}

main().catch(console.error);
