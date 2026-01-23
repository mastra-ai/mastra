/**
 * Filesystem Demo
 *
 * Demonstrates the Filesystem API within Workspace:
 * - Read files
 * - Write files
 * - List directory contents
 * - Check file existence
 * - Create directories
 * - Delete files
 *
 * Run with: pnpm demo:filesystem
 */

import { globalWorkspace } from '../mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('FILESYSTEM DEMO');
  console.log('='.repeat(70));
  console.log();

  // Initialize workspace
  console.log('Initializing workspace...');
  await globalWorkspace.init();
  console.log();

  // =========================================================================
  // PART 1: List Directory
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: LIST DIRECTORY');
  console.log('='.repeat(70));
  console.log();

  console.log('Listing root directory (/):');
  const rootEntries = await globalWorkspace.readdir('/');
  for (const entry of rootEntries.slice(0, 10)) {
    const icon = entry.type === 'directory' ? '📁' : '📄';
    console.log(`  ${icon} ${entry.name}`);
  }
  if (rootEntries.length > 10) {
    console.log(`  ... and ${rootEntries.length - 10} more`);
  }
  console.log();

  console.log('Listing /skills directory:');
  const skillsEntries = await globalWorkspace.readdir('/skills');
  for (const entry of skillsEntries) {
    const icon = entry.type === 'directory' ? '📁' : '📄';
    console.log(`  ${icon} ${entry.name}`);
  }
  console.log();

  // =========================================================================
  // PART 2: Check Existence
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: CHECK EXISTENCE');
  console.log('='.repeat(70));
  console.log();

  const pathsToCheck = ['/skills', '/skills/code-review', '/nonexistent', '/package.json'];
  for (const path of pathsToCheck) {
    const exists = await globalWorkspace.exists(path);
    console.log(`  ${path}: ${exists ? '✓ exists' : '✗ not found'}`);
  }
  console.log();

  // =========================================================================
  // PART 3: Read Files
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: READ FILES');
  console.log('='.repeat(70));
  console.log();

  // Read package.json
  console.log('Reading /package.json:');
  try {
    const packageJson = await globalWorkspace.readFile('/package.json');
    const content = typeof packageJson === 'string' ? packageJson : packageJson.toString();
    const parsed = JSON.parse(content);
    console.log(`  Name: ${parsed.name}`);
    console.log(`  Version: ${parsed.version || 'N/A'}`);
    console.log(`  Description: ${parsed.description?.slice(0, 50) || 'N/A'}...`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // Read a SKILL.md file
  console.log('Reading a skill file:');
  try {
    const skillContent = await globalWorkspace.readFile('/skills/code-review/SKILL.md');
    const content = typeof skillContent === 'string' ? skillContent : skillContent.toString();
    const lines = content.split('\n').slice(0, 5);
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    console.log('  ...');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 4: Write Files
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: WRITE FILES');
  console.log('='.repeat(70));
  console.log();

  const testDir = '/.demo-test';
  const testFile = `${testDir}/test-file.txt`;
  const testContent = `Hello from Filesystem Demo!\nCreated at: ${new Date().toISOString()}`;

  // Create directory
  console.log(`Creating directory: ${testDir}`);
  try {
    await globalWorkspace.filesystem?.mkdir(testDir);
    console.log('  ✓ Directory created');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // Write file
  console.log(`Writing file: ${testFile}`);
  try {
    await globalWorkspace.writeFile(testFile, testContent);
    console.log('  ✓ File written');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // Verify write
  console.log('Verifying written content:');
  try {
    const readBack = await globalWorkspace.readFile(testFile);
    const content = typeof readBack === 'string' ? readBack : readBack.toString();
    console.log(`  Content matches: ${content === testContent ? '✓ Yes' : '✗ No'}`);
    console.log(`  Content preview: ${content.split('\n')[0]}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 5: Delete Files
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 5: DELETE FILES');
  console.log('='.repeat(70));
  console.log();

  // Delete file
  console.log(`Deleting file: ${testFile}`);
  try {
    await globalWorkspace.filesystem?.deleteFile(testFile);
    const stillExists = await globalWorkspace.exists(testFile);
    console.log(`  ✓ File deleted (exists: ${stillExists})`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // Delete directory (requires recursive option)
  console.log(`Deleting directory: ${testDir}`);
  try {
    await globalWorkspace.filesystem?.rmdir(testDir, { recursive: true });
    const stillExists = await globalWorkspace.exists(testDir);
    console.log(`  ✓ Directory deleted (exists: ${stillExists})`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Filesystem API features demonstrated:');
  console.log('  - workspace.readdir(): List directory contents');
  console.log('  - workspace.exists(): Check if path exists');
  console.log('  - workspace.readFile(): Read file contents');
  console.log('  - workspace.writeFile(): Write file contents');
  console.log('  - workspace.filesystem.mkdir(): Create directories');
  console.log('  - workspace.filesystem.deleteFile(): Delete files');
  console.log('  - workspace.filesystem.rmdir(): Delete directories');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
