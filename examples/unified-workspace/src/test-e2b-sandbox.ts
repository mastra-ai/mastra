/**
 * Manual test script for E2B Sandbox
 *
 * Prerequisites:
 * 1. Set E2B_API_KEY environment variable
 * 2. Run: pnpm install (in this directory)
 * 3. Run: npx tsx src/test-e2b-sandbox.ts
 */

import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';

async function testBasicE2BSandbox() {
  console.log('\n=== Test 1: Basic E2B Sandbox (no filesystem) ===\n');

  const sandbox = new E2BSandbox({
    timeout: 60000, // 60 seconds
  });

  try {
    console.log('Starting sandbox...');
    await sandbox.start();
    console.log('Sandbox started!');

    // Test code execution
    console.log('\nExecuting Python code...');
    const pythonResult = await sandbox.executeCode('print("Hello from E2B!")', { runtime: 'python' });
    console.log('Python result:', pythonResult);

    console.log('\nExecuting Node.js code...');
    const nodeResult = await sandbox.executeCode('console.log("Hello from Node!")', { runtime: 'node' });
    console.log('Node result:', nodeResult);

    // Test command execution
    console.log('\nExecuting command...');
    const cmdResult = await sandbox.executeCommand('ls', ['-la', '/']);
    console.log('Command result (first 500 chars):', cmdResult.stdout.slice(0, 500));

    // Test file operations
    console.log('\nWriting file...');
    await sandbox.writeFile('/tmp/test.txt', 'Hello from Mastra!');

    console.log('Reading file...');
    const content = await sandbox.readFile('/tmp/test.txt');
    console.log('File content:', content);

    console.log('\nListing files in /tmp...');
    const files = await sandbox.listFiles('/tmp');
    console.log('Files:', files);

    console.log('\n✅ Basic E2B sandbox test passed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\nDestroying sandbox...');
    await sandbox.destroy();
  }
}

async function testE2BWithLocalFilesystem() {
  console.log('\n=== Test 2: E2B Sandbox with LocalFilesystem (sync mode) ===\n');

  // Create a temp directory for the local filesystem
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const tempDir = path.join(os.tmpdir(), `mastra-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  console.log('Created temp directory:', tempDir);

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: tempDir }),
    sandbox: new E2BSandbox({ timeout: 60000 }),
  });

  try {
    console.log('Initializing workspace...');
    await workspace.init();
    console.log('Workspace initialized!');
    console.log('Access mode:', workspace.accessMode); // Should be 'sync' since LocalFS can't mount into E2B

    // Write a file via workspace
    console.log('\nWriting file via workspace...');
    await workspace.writeFile('/hello.txt', 'Hello from workspace!');

    // Read it back
    const content = await workspace.readFile('/hello.txt', { encoding: 'utf-8' });
    console.log('File content:', content);

    // Execute code that reads the workspace mount path
    console.log('\nExecuting code in sandbox...');
    const result = await workspace.executeCode(
      `
import os
print("Current directory:", os.getcwd())
print("Files in /workspace:", os.listdir("/workspace") if os.path.exists("/workspace") else "Not mounted")
print("Files in /tmp:", os.listdir("/tmp"))
`,
      { runtime: 'python' },
    );
    console.log('Result:', result);

    console.log('\n✅ E2B with LocalFilesystem test passed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\nDestroying workspace...');
    await workspace.destroy();

    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function testE2BMountingCapabilities() {
  console.log('\n=== Test 3: E2B Mounting Capabilities Check ===\n');

  const sandbox = new E2BSandbox({ timeout: 60000 });
  const localFs = new LocalFilesystem({ basePath: '/tmp/test' });

  console.log('E2B sandbox supportsMounting:', sandbox.supportsMounting);
  console.log('LocalFilesystem supportsMounting:', localFs.supportsMounting);

  if (sandbox.canMount) {
    console.log('E2B canMount(LocalFilesystem):', sandbox.canMount(localFs));
    // LocalFS returns { type: 'local' }, E2B only supports s3/gcs/r2
    // So this should be false
  }

  console.log('\nE2B can mount these filesystem types:');
  console.log('- S3 (type: "s3")');
  console.log('- GCS (type: "gcs")');
  console.log('- R2 (type: "r2")');

  console.log('\n✅ Mounting capabilities check complete!');
}

async function main() {
  console.log('E2B Sandbox Manual Test');
  console.log('========================');

  if (!process.env.E2B_API_KEY) {
    console.error('\n❌ E2B_API_KEY environment variable not set!');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://e2b.dev');
    console.log('2. Sign up / Log in');
    console.log('3. Get your API key from the dashboard');
    console.log('4. Run: export E2B_API_KEY=your_key_here');
    process.exit(1);
  }

  // Test 3 doesn't need E2B running
  await testE2BMountingCapabilities();

  // Test 1: Basic sandbox
  await testBasicE2BSandbox();

  // Test 2: With local filesystem (sync mode)
  await testE2BWithLocalFilesystem();

  console.log('\n\n🎉 All tests complete!');
}

main().catch(console.error);
