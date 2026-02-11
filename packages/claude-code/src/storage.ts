import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryState, ResolvedConfig } from './types.js';
import { getMemoryDir } from './config.js';

const STATE_FILE = 'state.json';
const OBSERVATIONS_FILE = 'observations.md';
const HISTORY_DIR = 'history';

/**
 * File-based storage for observational memory.
 * Stores state in .mastra/memory/ as JSON + Markdown files.
 */
export class FileStorage {
  private dir: string;

  constructor(config: ResolvedConfig) {
    this.dir = getMemoryDir(config);
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    const historyDir = join(this.dir, HISTORY_DIR);
    if (!existsSync(historyDir)) {
      mkdirSync(historyDir, { recursive: true });
    }
  }

  /**
   * Load the current memory state.
   */
  loadState(): MemoryState {
    const statePath = join(this.dir, STATE_FILE);
    if (!existsSync(statePath)) {
      return this.defaultState();
    }
    try {
      const raw = readFileSync(statePath, 'utf-8');
      return JSON.parse(raw) as MemoryState;
    } catch {
      return this.defaultState();
    }
  }

  /**
   * Save the memory state.
   */
  saveState(state: MemoryState): void {
    this.ensureDir();
    const statePath = join(this.dir, STATE_FILE);
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

    // Also write observations as readable markdown
    const obsPath = join(this.dir, OBSERVATIONS_FILE);
    writeFileSync(obsPath, state.observations || '(no observations yet)', 'utf-8');
  }

  /**
   * Archive observations before reflection (for history).
   */
  archiveObservations(observations: string, generation: number): void {
    this.ensureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gen-${generation}-${timestamp}.md`;
    const archivePath = join(this.dir, HISTORY_DIR, filename);
    writeFileSync(archivePath, observations, 'utf-8');
  }

  /**
   * Load the current observations as a string.
   */
  loadObservations(): string {
    const state = this.loadState();
    return state.observations;
  }

  /**
   * Get the memory directory path.
   */
  getDir(): string {
    return this.dir;
  }

  private defaultState(): MemoryState {
    return {
      observations: '',
      observationTokens: 0,
      generationCount: 0,
      lastObservedAt: null,
      currentTask: null,
      suggestedResponse: null,
    };
  }
}
