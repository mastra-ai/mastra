import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage } from './storage.js';
import type { ResolvedConfig, MemoryState } from './types.js';

describe('FileStorage', () => {
  let tempDir: string;
  let storage: FileStorage;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mastra-om-test-'));
    const config: ResolvedConfig = {
      memoryDir: tempDir,
      observationThreshold: 80000,
      reflectionThreshold: 40000,
      model: 'test-model',
      debug: false,
    };
    storage = new FileStorage(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns default state when no state file exists', () => {
    const state = storage.loadState();
    expect(state.observations).toBe('');
    expect(state.observationTokens).toBe(0);
    expect(state.generationCount).toBe(0);
    expect(state.lastObservedAt).toBeNull();
    expect(state.currentTask).toBeNull();
    expect(state.suggestedResponse).toBeNull();
  });

  it('saves and loads state', () => {
    const state: MemoryState = {
      observations: '* 🔴 (14:30) Test observation',
      observationTokens: 42,
      generationCount: 1,
      lastObservedAt: '2026-01-15T14:30:00Z',
      currentTask: 'Testing',
      suggestedResponse: 'Continue testing',
    };

    storage.saveState(state);
    const loaded = storage.loadState();

    expect(loaded).toEqual(state);
  });

  it('writes observations as markdown', () => {
    storage.saveState({
      observations: '* 🔴 (14:30) Test observation',
      observationTokens: 42,
      generationCount: 0,
      lastObservedAt: null,
      currentTask: null,
      suggestedResponse: null,
    });

    const mdPath = join(tempDir, 'observations.md');
    expect(existsSync(mdPath)).toBe(true);
    const content = readFileSync(mdPath, 'utf-8');
    expect(content).toContain('Test observation');
  });

  it('archives observations', () => {
    const observations = '* 🔴 (14:30) Pre-reflection observations';
    storage.archiveObservations(observations, 0);

    const historyDir = join(tempDir, 'history');
    expect(existsSync(historyDir)).toBe(true);

    // Check that a file was created in history
    const files = readdirSync(historyDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^gen-0-/);

    const content = readFileSync(join(historyDir, files[0]!), 'utf-8');
    expect(content).toBe(observations);
  });

  it('creates directory structure', () => {
    const newDir = join(tempDir, 'nested', 'memory');
    const config: ResolvedConfig = {
      memoryDir: newDir,
      observationThreshold: 80000,
      reflectionThreshold: 40000,
      model: 'test-model',
      debug: false,
    };

    const newStorage = new FileStorage(config);
    expect(existsSync(newDir)).toBe(true);
    expect(existsSync(join(newDir, 'history'))).toBe(true);
  });
});
