/**
 * Basic Usage Examples for @mastra/workspace
 *
 * Run with: npx tsx examples/basic-usage.ts
 */

import {
  createMemoryWorkspace,
  createLocalWorkspace,
  createWorkspace,
  type Workspace,
  type WorkspaceConfig,
  type WorkspaceOwner,
} from '../src';

// =============================================================================
// Example 1: Quick Start - Memory Workspace
// =============================================================================

async function example1_memoryWorkspace() {
  console.log('\n=== Example 1: Memory Workspace ===\n');

  // Create an in-memory workspace (great for testing and ephemeral operations)
  const workspace = await createMemoryWorkspace({
    id: 'example-workspace',
    name: 'Example Workspace',
    scope: 'thread',
    agentId: 'my-agent',
    threadId: 'thread-123',
    withExecutor: true, // Enable code execution
  });

  try {
    // Write some files
    await workspace.writeFile('/code/hello.js', 'console.log("Hello from workspace!");');
    await workspace.writeFile('/data/config.json', JSON.stringify({ debug: true }, null, 2));

    // Read files
    const code = await workspace.readFile('/code/hello.js', { encoding: 'utf-8' });
    console.log('Code file:', code);

    // List directory
    const files = await workspace.readdir('/code');
    console.log('Files in /code:', files);

    // Execute code
    const result = await workspace.executeCode('console.log("Hello from workspace!");', {
      runtime: 'node',
    });
    console.log('Execution result:', result.stdout.trim());

    // Use key-value state
    await workspace.state?.set('counter', 42);
    const counter = await workspace.state?.get<number>('counter');
    console.log('Counter:', counter);

    // Get workspace info
    const info = await workspace.getInfo();
    console.log('Workspace info:', JSON.stringify(info, null, 2));
  } finally {
    // Cleanup
    await workspace.destroy();
  }
}

// =============================================================================
// Example 2: Local Filesystem Workspace
// =============================================================================

async function example2_localWorkspace() {
  console.log('\n=== Example 2: Local Workspace ===\n');

  // Create a workspace backed by the local filesystem
  const workspace = await createLocalWorkspace({
    id: 'local-workspace',
    name: 'Local Development Workspace',
    basePath: '/tmp/mastra-workspace-example',
    scope: 'agent',
    agentId: 'dev-agent',
  });

  try {
    // Files persist to disk
    await workspace.writeFile('/README.md', '# My Workspace\n\nThis is a local workspace.');
    await workspace.writeFile('/src/index.ts', 'export const greeting = "Hello!";');

    // Execute a shell command
    const lsResult = await workspace.executeCommand('ls', ['-la', '/tmp/mastra-workspace-example']);
    console.log('Directory listing:\n', lsResult.stdout);

    // Execute code
    const nodeResult = await workspace.executeCode(
      'const fs = require("fs"); console.log(fs.readdirSync("/tmp/mastra-workspace-example/src"));',
      { runtime: 'node' },
    );
    console.log('Files via Node:', nodeResult.stdout.trim());
  } finally {
    await workspace.destroy();
  }
}

// =============================================================================
// Example 3: Snapshots and Restore
// =============================================================================

async function example3_snapshots() {
  console.log('\n=== Example 3: Snapshots ===\n');

  const workspace = await createMemoryWorkspace({
    id: 'snapshot-workspace',
    scope: 'thread',
  });

  try {
    // Create initial state
    await workspace.writeFile('/file1.txt', 'Original content');
    await workspace.writeFile('/file2.txt', 'Another file');

    // Take a snapshot
    const snapshot = await workspace.snapshot!({ name: 'checkpoint-1' });
    console.log('Snapshot created:', snapshot.id, 'Size:', snapshot.size, 'bytes');

    // Modify state
    await workspace.writeFile('/file1.txt', 'Modified content');
    await workspace.writeFile('/file3.txt', 'New file');

    console.log('After modification:');
    console.log(' - file1:', await workspace.readFile('/file1.txt', { encoding: 'utf-8' }));
    console.log(' - file3 exists:', await workspace.exists('/file3.txt'));

    // Restore from snapshot
    await workspace.restore!(snapshot);

    console.log('After restore:');
    console.log(' - file1:', await workspace.readFile('/file1.txt', { encoding: 'utf-8' }));
    console.log(' - file3 exists:', await workspace.exists('/file3.txt'));
  } finally {
    await workspace.destroy();
  }
}

// =============================================================================
// Example 4: Multi-Thread Isolation
// =============================================================================

async function example4_threadIsolation() {
  console.log('\n=== Example 4: Thread Isolation ===\n');

  // Simulate multiple threads with isolated workspaces
  const threadA = await createMemoryWorkspace({
    id: 'thread-a',
    scope: 'thread',
    agentId: 'coding-agent',
    threadId: 'thread-a',
  });

  const threadB = await createMemoryWorkspace({
    id: 'thread-b',
    scope: 'thread',
    agentId: 'coding-agent',
    threadId: 'thread-b',
  });

  try {
    // Thread A works on feature-1
    await threadA.writeFile('/code.js', 'function featureA() { return "A"; }');
    await threadA.state?.set('task', 'implementing feature A');

    // Thread B works on feature-2
    await threadB.writeFile('/code.js', 'function featureB() { return "B"; }');
    await threadB.state?.set('task', 'implementing feature B');

    // Each thread has isolated state
    console.log('Thread A code:', await threadA.readFile('/code.js', { encoding: 'utf-8' }));
    console.log('Thread B code:', await threadB.readFile('/code.js', { encoding: 'utf-8' }));

    console.log('Thread A task:', await threadA.state?.get('task'));
    console.log('Thread B task:', await threadB.state?.get('task'));
  } finally {
    await threadA.destroy();
    await threadB.destroy();
  }
}

// =============================================================================
// Example 5: Custom Workspace Configuration
// =============================================================================

async function example5_customConfig() {
  console.log('\n=== Example 5: Custom Configuration ===\n');

  // Use createWorkspace for full control over configuration
  const config: WorkspaceConfig = {
    id: 'custom-workspace',
    name: 'Custom Configured Workspace',
    scope: 'agent',
    filesystem: {
      provider: 'memory',
      id: 'custom-fs',
      initialFiles: {
        '/README.md': '# Pre-configured Workspace',
        '/config.json': '{"initialized": true}',
      },
    },
    executor: {
      provider: 'local',
      id: 'custom-exec',
      defaultRuntime: 'node',
      timeout: 60000,
    },
  };

  const owner: WorkspaceOwner = {
    scope: 'agent',
    agentId: 'custom-agent',
  };

  const workspace = await createWorkspace(config, owner);

  try {
    // Workspace is pre-configured with files
    console.log('Pre-configured README:', await workspace.readFile('/README.md', { encoding: 'utf-8' }));
    console.log('Pre-configured config:', await workspace.readFile('/config.json', { encoding: 'utf-8' }));
  } finally {
    await workspace.destroy();
  }
}

// =============================================================================
// Run Examples
// =============================================================================

async function main() {
  console.log('Workspace Examples\n==================');

  await example1_memoryWorkspace();
  await example3_snapshots();
  await example4_threadIsolation();
  await example5_customConfig();

  // Skip local workspace in CI/automated environments
  if (process.env.RUN_LOCAL_EXAMPLES) {
    await example2_localWorkspace();
  }

  console.log('\n✅ All examples completed!');
}

main().catch(console.error);
