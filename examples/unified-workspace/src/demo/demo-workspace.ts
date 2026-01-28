/**
 * Workspace API Demo
 *
 * Demonstrates the core Workspace class API:
 * - Workspace initialization and status
 * - Workspace info and capabilities
 * - Search API (BM25 index, search, unindex)
 *
 * Run with: pnpm demo:workspace
 */

import { globalWorkspace } from '../mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('WORKSPACE API DEMO');
  console.log('='.repeat(70));
  console.log();

  // =========================================================================
  // PART 1: Initialization
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: INITIALIZATION');
  console.log('='.repeat(70));
  console.log();

  console.log('Initializing workspace...');
  await globalWorkspace.init();
  console.log(`  Status: ${globalWorkspace.status}`);
  console.log(`  ID: ${globalWorkspace.id}`);
  console.log(`  Name: ${globalWorkspace.name}`);
  console.log();

  // =========================================================================
  // PART 2: Capabilities
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: CAPABILITIES');
  console.log('='.repeat(70));
  console.log();

  console.log('Workspace capabilities:');
  console.log(`  Filesystem: ${globalWorkspace.filesystem ? 'Configured' : 'Not configured'}`);
  console.log(`  Sandbox: ${globalWorkspace.sandbox ? 'Configured' : 'Not configured'}`);
  console.log(`  BM25 Search: ${globalWorkspace.canBM25 ? 'Enabled' : 'Disabled'}`);
  console.log(`  Vector Search: ${globalWorkspace.canVector ? 'Enabled' : 'Disabled'}`);
  console.log(`  Hybrid Search: ${globalWorkspace.canHybrid ? 'Enabled' : 'Disabled'}`);
  console.log(`  Skills: ${globalWorkspace.skills ? 'Configured' : 'Not configured'}`);
  console.log();

  // =========================================================================
  // PART 3: Workspace Info
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: WORKSPACE INFO');
  console.log('='.repeat(70));
  console.log();

  const info = await globalWorkspace.getInfo();
  console.log('Workspace info:');
  console.log(`  ID: ${info.id}`);
  console.log(`  Name: ${info.name}`);
  console.log(`  Status: ${info.status}`);
  console.log();
  console.log('Filesystem info:');
  console.log(`  Provider: ${info.filesystem?.provider || 'None'}`);
  console.log(`  Total files: ${info.filesystem?.totalFiles ?? 'N/A'}`);
  console.log(`  Total size: ${info.filesystem?.totalSize ?? 'N/A'} bytes`);
  console.log();

  // =========================================================================
  // PART 4: Search API (BM25)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: SEARCH API (BM25)');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.canBM25) {
    // Index sample content
    console.log('Indexing sample content...');
    await globalWorkspace.index(
      '/sample/typescript.txt',
      'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
    );
    await globalWorkspace.index(
      '/sample/nodejs.txt',
      'Node.js is a JavaScript runtime built on Chrome V8 engine for server-side applications.',
    );
    await globalWorkspace.index(
      '/sample/react.txt',
      'React is a JavaScript library for building user interfaces with component-based architecture.',
    );
    console.log('  Indexed 3 documents');
    console.log();

    // Search
    console.log('Searching for "JavaScript":');
    const jsResults = await globalWorkspace.search('JavaScript', { topK: 3 });
    for (const result of jsResults) {
      console.log(`  - [${result.id}] score: ${result.score.toFixed(3)}`);
    }
    console.log();

    console.log('Searching for "TypeScript typed":');
    const tsResults = await globalWorkspace.search('TypeScript typed', { topK: 2 });
    for (const result of tsResults) {
      console.log(`  - [${result.id}] score: ${result.score.toFixed(3)}`);
    }
    console.log();

    // Unindex
    console.log('Cleaning up indexed content...');
    await globalWorkspace.unindex('/sample/typescript.txt');
    await globalWorkspace.unindex('/sample/nodejs.txt');
    await globalWorkspace.unindex('/sample/react.txt');
    console.log('  Unindexed 3 documents');
    console.log();
  } else {
    console.log('BM25 search is not enabled.');
    console.log();
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Workspace API features demonstrated:');
  console.log('  - init(): Initialize workspace');
  console.log('  - status, id, name: Workspace properties');
  console.log('  - getInfo(): Get detailed workspace information');
  console.log('  - canBM25, canVector, canHybrid: Search capability flags');
  console.log('  - index(): Add content to search index');
  console.log('  - search(): Query indexed content');
  console.log('  - unindex(): Remove content from index');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
