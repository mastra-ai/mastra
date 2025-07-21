import fs from 'fs/promises';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalSandbox } from './local';

describe('LocalSandbox', () => {
  let sandbox: LocalSandbox;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(process.cwd(), 'test-sandbox', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    sandbox = new LocalSandbox({
      workingDirectory: testDir,
      environment: { TEST_ENV: 'test' },
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('create', () => {
    it('should create a sandbox with unique ID', async () => {
      const result = await sandbox.create({ language: 'typescript' });

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^local-\d+-\w+$/);
    });

    it('should create sandbox directory', async () => {
      const result = await sandbox.create({ language: 'typescript' });
      const sandboxDir = path.join(testDir, '.mastra-sandbox', result.id);

      const exists = await fs
        .access(sandboxDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete sandbox directory', async () => {
      const result = await sandbox.create({ language: 'typescript' });
      const sandboxDir = path.join(testDir, '.mastra-sandbox', result.id);

      // Verify sandbox was created
      const exists = await fs
        .access(sandboxDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Delete the sandbox
      await sandbox.delete(result.id);

      // Verify sandbox was deleted
      const stillExists = await fs
        .access(sandboxDir)
        .then(() => true)
        .catch(() => false);
      expect(stillExists).toBe(false);
    });

    it('should handle deleting non-existent sandbox gracefully', async () => {
      // Should not throw an error when trying to delete a non-existent sandbox
      await expect(sandbox.delete('non-existent-sandbox')).resolves.not.toThrow();
    });

    it('should clean up sandbox with files', async () => {
      const result = await sandbox.create({ language: 'typescript' });

      // Create some files in the sandbox
      await sandbox.writeFile('test-file.txt', 'test content');
      await sandbox.createDirectory('test-dir');
      await sandbox.writeFile('test-dir/nested-file.txt', 'nested content');

      // Delete the sandbox
      await sandbox.delete(result.id);

      // Verify sandbox directory was completely removed
      const sandboxDir = path.join(testDir, '.mastra-sandbox', result.id);
      const stillExists = await fs
        .access(sandboxDir)
        .then(() => true)
        .catch(() => false);
      expect(stillExists).toBe(false);
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      const content = 'console.log("Hello World");';
      await sandbox.writeFile('test.js', content);

      const writtenContent = await fs.readFile(path.join(testDir, 'test.js'), 'utf8');
      expect(writtenContent).toBe(content);
    });

    it('should create directories if they do not exist', async () => {
      const content = 'test content';
      await sandbox.writeFile('src/components/Button.js', content);

      const filePath = path.join(testDir, 'src', 'components', 'Button.js');
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const writtenContent = await fs.readFile(filePath, 'utf8');
      expect(writtenContent).toBe(content);
    });
  });

  describe('readFile', () => {
    it('should read existing file', async () => {
      const content = 'test content';
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, content);

      const result = await sandbox.readFile('test.txt');
      expect(result).toBe(content);
    });

    it('should return null for non-existent file', async () => {
      const result = await sandbox.readFile('non-existent.txt');
      expect(result).toBe(null);
    });
  });

  describe('createDirectory', () => {
    it('should create directory', async () => {
      await sandbox.createDirectory('src/components');

      const dirPath = path.join(testDir, 'src', 'components');
      const exists = await fs
        .access(dirPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create nested directories', async () => {
      await sandbox.createDirectory('src/components/ui/buttons');

      const dirPath = path.join(testDir, 'src', 'components', 'ui', 'buttons');
      const exists = await fs
        .access(dirPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('should list files and directories', async () => {
      // Create some test files and directories
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'dir1'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'dir2'), { recursive: true });

      const files = await sandbox.listFiles('.');

      expect(files).toHaveLength(4);
      expect(files).toContainEqual({ name: 'file1.txt', type: 'file' });
      expect(files).toContainEqual({ name: 'file2.txt', type: 'file' });
      expect(files).toContainEqual({ name: 'dir1', type: 'directory' });
      expect(files).toContainEqual({ name: 'dir2', type: 'directory' });
    });
  });

  describe('executeCommand', () => {
    it('should execute shell command successfully', async () => {
      const result = await sandbox.executeCommand('echo "Hello World"');

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('Hello World');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command failures', async () => {
      const result = await sandbox.executeCommand('nonexistent-command');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toBeTruthy();
    });

    it('should use custom working directory', async () => {
      await sandbox.createDirectory('test-dir');
      await sandbox.writeFile('test-dir/test.txt', 'test content');

      const result = await sandbox.executeCommand('ls', {
        workingDirectory: path.join(testDir, 'test-dir'),
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test.txt');
    });

    it('should use custom environment variables', async () => {
      const result = await sandbox.executeCommand('echo $CUSTOM_VAR', {
        environment: { CUSTOM_VAR: 'test-value' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('test-value');
    });
  });

  describe('executeCode', () => {
    it('should execute JavaScript code', async () => {
      const result = await sandbox.executeCode('console.log("Hello from JS");', {
        language: 'javascript',
      });

      expect(result.success).toBe(true);
      expect(result.output.trim()).toBe('Hello from JS');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should execute Python code', async () => {
      const result = await sandbox.executeCode('print("Hello from Python")', {
        language: 'python',
      });

      expect(result.success).toBe(true);
      expect(result.output.trim()).toBe('Hello from Python');
    });

    it('should handle code execution errors', async () => {
      const result = await sandbox.executeCode('console.log(undefined.property);', {
        language: 'javascript',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should use custom environment variables', async () => {
      const result = await sandbox.executeCode('console.log(process.env.CUSTOM_VAR);', {
        language: 'javascript',
        environment: { CUSTOM_VAR: 'test-value' },
      });

      expect(result.success).toBe(true);
      expect(result.output.trim()).toBe('test-value');
    });
  });

  describe('environment management', () => {
    it('should set and get environment variables', async () => {
      await sandbox.setEnvironment({ TEST_VAR: 'test-value' });

      const env = await sandbox.getEnvironment();
      expect(env.TEST_VAR).toBe('test-value');
    });

    it('should merge environment variables', async () => {
      await sandbox.setEnvironment({ VAR1: 'value1' });
      await sandbox.setEnvironment({ VAR2: 'value2' });

      const env = await sandbox.getEnvironment();
      expect(env.VAR1).toBe('value1');
      expect(env.VAR2).toBe('value2');
    });
  });

  describe('working directory', () => {
    it('should set working directory', async () => {
      const newDir = path.join(testDir, 'new-dir');
      await fs.mkdir(newDir, { recursive: true });

      await sandbox.setWorkingDirectory(newDir);
      await sandbox.writeFile('test.txt', 'content');

      const filePath = path.join(newDir, 'test.txt');
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should create a simple project and run it', async () => {
      // Create a simple Node.js project
      await sandbox.writeFile(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            start: 'node index.js',
          },
        }),
      );

      await sandbox.writeFile(
        'index.js',
        `
        console.log('Hello from test project!');
        console.log('Environment:', process.env.NODE_ENV);
      `,
      );

      // Run the project
      const result = await sandbox.executeCommand('npm start', {
        environment: { NODE_ENV: 'production' },
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello from test project!');
      expect(result.stdout).toContain('production');
    });

    it('should handle TypeScript code execution', async () => {
      const result = await sandbox.executeCode(
        `
        interface User {
          name: string;
          age: number;
        }

        const user: User = { name: 'John', age: 30 };
        console.log(\`User: \${user.name}, Age: \${user.age}\`);
      `,
        {
          language: 'typescript',
        },
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('User: John, Age: 30');
    });
  });
});
