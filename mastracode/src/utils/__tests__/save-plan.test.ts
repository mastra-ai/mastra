import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { savePlanToDisk, savePlanSnapshot } from '../plans.js';

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

describe('savePlanSnapshot', () => {
  it('writes a current-plan.md file to the local project plans dir', async () => {
    await savePlanSnapshot({
      title: 'My plan',
      plan: 'Step 1\nStep 2',
      resourceId: 'proj-snapshot',
      projectPath: tmpProjectPath,
    });

    const filePath = path.join(tmpProjectPath, '.mastracode', 'plans', 'proj-snapshot', 'current-plan.md');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('# My plan');
    expect(content).toContain('Step 1');
    expect(content).toContain('Step 2');
  });

  it('overwrites the snapshot on resubmission', async () => {
    await savePlanSnapshot({
      title: 'Plan v1',
      plan: 'Original content',
      resourceId: 'proj-overwrite',
      projectPath: tmpProjectPath,
    });

    await savePlanSnapshot({
      title: 'Plan v2',
      plan: 'Updated content',
      resourceId: 'proj-overwrite',
      projectPath: tmpProjectPath,
    });

    const filePath = path.join(tmpProjectPath, '.mastracode', 'plans', 'proj-overwrite', 'current-plan.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('# Plan v2');
    expect(content).toContain('Updated content');
    expect(content).not.toContain('Original content');
  });

  it('respects plansDir override', async () => {
    await savePlanSnapshot({
      title: 'Custom dir plan',
      plan: 'Custom location.',
      resourceId: 'proj-custom',
      projectPath: tmpProjectPath,
      plansDir: tmpDir,
    });

    const filePath = path.join(tmpDir, 'proj-custom', 'current-plan.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
