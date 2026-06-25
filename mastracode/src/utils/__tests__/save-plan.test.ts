import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import {
  savePlanToDisk,
  getPlanFilename,
  getCurrentPlanFilename,
  getCurrentPlanPath,
  readCurrentPlan,
  approveCurrentPlan,
} from '../plans.js';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const tmpDir = path.join(projectRoot, '.test-tmp-plans');
const tmpProjectPath = path.join(projectRoot, '.test-tmp-project');
const TEST_THREAD_ID = 'thread-test-save-plan';

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

function writeCurrentPlan(content: string, threadId = TEST_THREAD_ID): void {
  const filePath = getCurrentPlanPath(tmpProjectPath, threadId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('getCurrentPlanPath', () => {
  it('points to the thread-scoped working plan file', () => {
    expect(getCurrentPlanPath(tmpProjectPath, TEST_THREAD_ID)).toBe(
      path.join(tmpProjectPath, '.mastracode', 'plans', getCurrentPlanFilename(TEST_THREAD_ID)),
    );
  });
});

describe('readCurrentPlan', () => {
  it('returns undefined when the working file does not exist', async () => {
    expect(await readCurrentPlan(tmpProjectPath, TEST_THREAD_ID)).toBeUndefined();
  });

  it('parses the leading heading as the title and the rest as the body', async () => {
    writeCurrentPlan('# My plan\n\nStep 1\nStep 2\n');

    const result = await readCurrentPlan(tmpProjectPath, TEST_THREAD_ID);
    expect(result).toEqual({ title: 'My plan', plan: 'Step 1\nStep 2' });
  });

  it('returns an empty title when there is no leading heading', async () => {
    writeCurrentPlan('Just a body with no heading\n');

    const result = await readCurrentPlan(tmpProjectPath, TEST_THREAD_ID);
    expect(result).toEqual({ title: '', plan: 'Just a body with no heading' });
  });
});

describe('approveCurrentPlan', () => {
  it('archives current-plan.md to a slugified local file and deletes the working file', async () => {
    writeCurrentPlan('# My plan\n\nStep 1\nStep 2\n');

    const filename = await approveCurrentPlan({
      title: 'My plan',
      projectPath: tmpProjectPath,
      resourceId: 'resource-1',
      threadId: TEST_THREAD_ID,
      plansDir: tmpDir,
    });

    expect(filename).toBe('my-plan.md');

    const archivePath = path.join(tmpProjectPath, '.mastracode', 'plans', 'my-plan.md');
    expect(fs.existsSync(archivePath)).toBe(true);
    const archived = fs.readFileSync(archivePath, 'utf-8');
    expect(archived).toContain('# My plan');
    expect(archived).toContain('Step 1');

    // Working file is deleted so the next plan starts fresh.
    expect(fs.existsSync(getCurrentPlanPath(tmpProjectPath, TEST_THREAD_ID))).toBe(false);

    // Global archive (timestamped) was written under the resource dir.
    const resourceDir = path.join(tmpDir, 'resource-1');
    expect(fs.existsSync(resourceDir)).toBe(true);
    const globalFiles = fs.readdirSync(resourceDir);
    expect(globalFiles.some(f => f.endsWith('-my-plan.md'))).toBe(true);
  });

  it('uses the title from the file when no title is provided', async () => {
    writeCurrentPlan('# File title\n\nBody\n');

    const filename = await approveCurrentPlan({
      title: '',
      projectPath: tmpProjectPath,
      resourceId: 'resource-2',
      threadId: TEST_THREAD_ID,
      plansDir: tmpDir,
    });

    expect(filename).toBe('file-title.md');
  });

  it('returns undefined when there is no working plan file', async () => {
    const filename = await approveCurrentPlan({
      title: 'Anything',
      projectPath: tmpProjectPath,
      resourceId: 'resource-3',
      threadId: TEST_THREAD_ID,
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
