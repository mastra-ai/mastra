/**
 * Provider Integration Tests
 *
 * Tests the filesystem and sandbox providers.
 * These tests verify the providers work correctly and can be used with the Workspace class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RamFilesystem } from './filesystem/providers/ram';
import { LocalSandbox } from './sandbox/providers/local';

describe('RamFilesystem + LocalSandbox Integration', () => {
  let fs: RamFilesystem;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    fs = new RamFilesystem({ id: 'test-fs' });
    sandbox = new LocalSandbox({ id: 'test-sandbox' });
    await sandbox.start();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should work together for a complete workflow', async () => {
    // Write code to filesystem
    const code = 'console.log("Hello from integrated test!")';
    await fs.writeFile('/app.js', code);

    // Read it back
    const content = await fs.readFile('/app.js', { encoding: 'utf-8' });
    expect(content).toBe(code);

    // Execute the code in sandbox
    const result = await sandbox.executeCode(content, { runtime: 'node' });
    expect(result.stdout.trim()).toBe('Hello from integrated test!');
    expect(result.exitCode).toBe(0);
  });

  it('should support state-like operations on filesystem', async () => {
    // Simulate state storage using the filesystem
    const stateDir = '/.state';
    await fs.mkdir(stateDir, { recursive: true });

    const state = { counter: 42, name: 'test' };
    await fs.writeFile(`${stateDir}/app.json`, JSON.stringify(state));

    const content = await fs.readFile(`${stateDir}/app.json`, { encoding: 'utf-8' });
    const restored = JSON.parse(content as string);
    expect(restored.counter).toBe(42);
    expect(restored.name).toBe('test');
  });

  it('should support snapshot-like operations', async () => {
    // Create some files
    await fs.writeFile('/data/file1.txt', 'content1');
    await fs.writeFile('/data/file2.txt', 'content2');

    // "Snapshot" by reading all files
    const files: Record<string, string> = {};
    const entries = await fs.readdir('/data');
    for (const entry of entries) {
      if (entry.type === 'file') {
        const content = await fs.readFile(`/data/${entry.name}`, { encoding: 'utf-8' });
        files[entry.name] = content as string;
      }
    }

    expect(Object.keys(files)).toHaveLength(2);
    expect(files['file1.txt']).toBe('content1');
    expect(files['file2.txt']).toBe('content2');
  });
});

describe('LocalSandbox code execution', () => {
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    sandbox = new LocalSandbox();
    await sandbox.start();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should execute Node.js code', async () => {
    const result = await sandbox.executeCode('console.log("Node works!")', {
      runtime: 'node',
    });
    expect(result.stdout.trim()).toBe('Node works!');
    expect(result.exitCode).toBe(0);
    expect(result.runtime).toBe('node');
  });

  it('should execute shell commands', async () => {
    const result = await sandbox.executeCommand('echo', ['Hello', 'World']);
    expect(result.stdout.trim()).toBe('Hello World');
    expect(result.exitCode).toBe(0);
  });

  it('should have correct status transitions', async () => {
    const newSandbox = new LocalSandbox();
    expect(newSandbox.status).toBe('pending');

    await newSandbox.start();
    expect(newSandbox.status).toBe('running');

    await newSandbox.stop();
    expect(newSandbox.status).toBe('stopped');

    await newSandbox.destroy();
    expect(newSandbox.status).toBe('destroyed');
  });

  it('should support Python if available', async () => {
    if (sandbox.supportedRuntimes.includes('python')) {
      const result = await sandbox.executeCode('print("Python works!")', {
        runtime: 'python',
      });
      expect(result.stdout.trim()).toBe('Python works!');
      expect(result.runtime).toBe('python');
    }
  });

  it('should provide sandbox info', async () => {
    const info = await sandbox.getInfo();
    expect(info.id).toBe(sandbox.id);
    expect(info.provider).toBe('local');
    expect(info.status).toBe('running');
    expect(info.createdAt).toBeInstanceOf(Date);
  });
});
