import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import {
  savePlanToDisk,
  getPlanFilename,
  getLocalPlansDir,
  isPlanFilePath,
  readPlanFile,
  approvePlanFile,
} from '../plans.js';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const tmpDir = path.join(projectRoot, '.test-tmp-plans');
const tmpProjectPath = path.join(projectRoot, '.test-tmp-project');

afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  if (fs.existsSync(tmpProjectPath)) {
    fs.rmSync(tmpProjectPath, { recursive: true });
  }
});

afterAll(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  if (fs.existsSync(tmpProjectPath)) {
    fs.rmSync(tmpProjectPath, { recursive: true });
  }
});

describe('savePlanToDisk', () => {
  it('writes a markdown file to the plans directory', async () => {
    await savePlanToDisk({
      title: 'Add dark mode toggle',
      plan: '## Steps\n\n1. Add theme context\n2. Create toggle component',
      resourceId: 'my-project-abc123',
      plansDir: tmpDir,
    });

    const files = fs.readdirSync(path.join(tmpDir, 'my-project-abc123'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.*-add-dark-mode-toggle\.md$/);
  });

  it('includes title, timestamp, and plan content in the file', async () => {
    const before = new Date();
    await savePlanToDisk({
      title: 'Refactor auth module',
      plan: 'Extract shared helpers into a utils file.',
      resourceId: 'test-proj-def456',
      plansDir: tmpDir,
    });
    const after = new Date();

    const dir = path.join(tmpDir, 'test-proj-def456');
    const files = fs.readdirSync(dir);
    const content = fs.readFileSync(path.join(dir, files[0]!), 'utf-8');

    // Title is present as a heading
    expect(content).toContain('# Refactor auth module');
    // Plan body is present
    expect(content).toContain('Extract shared helpers into a utils file.');
    // Timestamp is present and within the window
    const match = content.match(/Approved: (.+)/);
    expect(match).not.toBeNull();
    const ts = new Date(match![1]!);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('creates the resource subdirectory if it does not exist', async () => {
    const resourceDir = path.join(tmpDir, 'new-project-ghi789');
    expect(fs.existsSync(resourceDir)).toBe(false);

    await savePlanToDisk({
      title: 'Initial setup',
      plan: 'Scaffold the project.',
      resourceId: 'new-project-ghi789',
      plansDir: tmpDir,
    });

    expect(fs.existsSync(resourceDir)).toBe(true);
    expect(fs.readdirSync(resourceDir)).toHaveLength(1);
  });

  it('handles special characters in the title', async () => {
    await savePlanToDisk({
      title: 'Fix bug #42: handle "quotes" & <brackets>',
      plan: 'Escape properly.',
      resourceId: 'proj-special',
      plansDir: tmpDir,
    });

    const files = fs.readdirSync(path.join(tmpDir, 'proj-special'));
    expect(files).toHaveLength(1);
    // Should be slugified — no special chars
    expect(files[0]).toMatch(/\.md$/);
    expect(files[0]).not.toMatch(/[#"&<>]/);
  });

  it('falls back to "untitled" when title has only special characters', async () => {
    await savePlanToDisk({
      title: '#@!$%',
      plan: 'Some plan.',
      resourceId: 'proj-empty-slug',
      plansDir: tmpDir,
    });

    const files = fs.readdirSync(path.join(tmpDir, 'proj-empty-slug'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/-untitled\.md$/);
  });

  it('rejects path traversal in resourceId', async () => {
    await expect(
      savePlanToDisk({
        title: 'Malicious',
        plan: 'exploit',
        resourceId: '../../../etc',
        plansDir: tmpDir,
      }),
    ).rejects.toThrow('Invalid resourceId');
  });

  it('rejects absolute path in resourceId', async () => {
    await expect(
      savePlanToDisk({
        title: 'Malicious',
        plan: 'exploit',
        resourceId: '/tmp/evil',
        plansDir: tmpDir,
      }),
    ).rejects.toThrow('Invalid resourceId');
  });

  it('does not overwrite existing plans', async () => {
    const opts = {
      title: 'Same plan',
      plan: 'Content v1.',
      resourceId: 'proj-dupes',
      plansDir: tmpDir,
    };

    await savePlanToDisk(opts);
    // Small delay so timestamp differs
    await new Promise(r => setTimeout(r, 10));
    await savePlanToDisk({ ...opts, plan: 'Content v2.' });

    const files = fs.readdirSync(path.join(tmpDir, 'proj-dupes'));
    expect(files).toHaveLength(2);
  });
});

function writePlanFile(filename: string, content: string): string {
  const filePath = path.join(getLocalPlansDir(tmpProjectPath), filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('isPlanFilePath', () => {
  it('accepts a .md file directly inside .mastracode/plans/', () => {
    expect(isPlanFilePath(tmpProjectPath, '.mastracode/plans/add-dark-mode.md')).toBe(true);
  });

  it('accepts an absolute path inside .mastracode/plans/', () => {
    const abs = path.join(getLocalPlansDir(tmpProjectPath), 'feature.md');
    expect(isPlanFilePath(tmpProjectPath, abs)).toBe(true);
  });

  it('rejects files outside .mastracode/plans/', () => {
    expect(isPlanFilePath(tmpProjectPath, 'src/index.ts')).toBe(false);
    expect(isPlanFilePath(tmpProjectPath, '.mastracode/other.md')).toBe(false);
  });

  it('rejects non-markdown files and nested subdirectories', () => {
    expect(isPlanFilePath(tmpProjectPath, '.mastracode/plans/notes.txt')).toBe(false);
    expect(isPlanFilePath(tmpProjectPath, '.mastracode/plans/sub/plan.md')).toBe(false);
  });

  it('rejects path traversal out of the plans directory', () => {
    expect(isPlanFilePath(tmpProjectPath, '.mastracode/plans/../../evil.md')).toBe(false);
  });
});

describe('readPlanFile', () => {
  it('returns undefined when the file does not exist', async () => {
    expect(await readPlanFile(path.join(getLocalPlansDir(tmpProjectPath), 'missing.md'))).toBeUndefined();
  });

  it('parses the leading heading as the title and the rest as the body', async () => {
    const file = writePlanFile('my-plan.md', '# My plan\n\nStep 1\nStep 2\n');

    expect(await readPlanFile(file)).toEqual({ title: 'My plan', plan: 'Step 1\nStep 2' });
  });

  it('returns an empty title when there is no leading heading', async () => {
    const file = writePlanFile('no-heading.md', 'Just a body with no heading\n');

    expect(await readPlanFile(file)).toEqual({ title: '', plan: 'Just a body with no heading' });
  });
});

describe('approvePlanFile', () => {
  it('archives the plan to the global plans dir and leaves the local file in place', async () => {
    const file = writePlanFile('my-plan.md', '# My plan\n\nStep 1\nStep 2\n');

    const filename = await approvePlanFile({
      planPath: file,
      title: 'My plan',
      resourceId: 'resource-1',
      plansDir: tmpDir,
    });

    expect(filename).toBe('my-plan.md');

    // The local named plan file is preserved so the user can review it later.
    expect(fs.existsSync(file)).toBe(true);

    // Global archive (timestamped) was written under the resource dir.
    const resourceDir = path.join(tmpDir, 'resource-1');
    expect(fs.existsSync(resourceDir)).toBe(true);
    const globalFiles = fs.readdirSync(resourceDir);
    expect(globalFiles.some(f => f.endsWith('-my-plan.md'))).toBe(true);
  });

  it('uses the title from the file when no title is provided', async () => {
    const file = writePlanFile('file-title.md', '# File title\n\nBody\n');

    const filename = await approvePlanFile({
      planPath: file,
      title: '',
      resourceId: 'resource-2',
      plansDir: tmpDir,
    });

    expect(filename).toBe('file-title.md');
  });

  it('returns undefined when the plan file does not exist', async () => {
    const filename = await approvePlanFile({
      planPath: path.join(getLocalPlansDir(tmpProjectPath), 'missing.md'),
      title: 'Anything',
      resourceId: 'resource-3',
      plansDir: tmpDir,
    });

    expect(filename).toBeUndefined();
  });
});

describe('getPlanFilename', () => {
  it('returns a slugified filename from the title', () => {
    expect(getPlanFilename('Add dark mode toggle')).toBe('add-dark-mode-toggle.md');
  });

  it('handles special characters', () => {
    expect(getPlanFilename('Fix bug #42: handle "quotes"')).toBe('fix-bug-42-handle-quotes.md');
  });

  it('falls back to untitled for empty slugs', () => {
    expect(getPlanFilename('#@!$%')).toBe('untitled.md');
  });
});
