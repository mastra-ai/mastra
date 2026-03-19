import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { truncateLogFile, setupDebugLogging } from '../debug-log.js';

describe('truncateLogFile', () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-log-test-'));
    logFile = path.join(tmpDir, 'debug.log');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not touch a file under 5 MB', () => {
    const content = 'line one\nline two\nline three\n';
    fs.writeFileSync(logFile, content);
    truncateLogFile(logFile);
    expect(fs.readFileSync(logFile, 'utf-8')).toBe(content);
  });

  it('should truncate a file over 5 MB to roughly 4 MB', () => {
    // Write ~6 MB of log lines
    const line = '[ERROR] 2026-01-01T00:00:00.000Z some error message here\n';
    const repeatCount = Math.ceil((6 * 1024 * 1024) / line.length);
    const content = line.repeat(repeatCount);
    fs.writeFileSync(logFile, content);

    const sizeBefore = fs.statSync(logFile).size;
    expect(sizeBefore).toBeGreaterThan(5 * 1024 * 1024);

    truncateLogFile(logFile);

    const sizeAfter = fs.statSync(logFile).size;
    expect(sizeAfter).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(sizeAfter).toBeGreaterThan(3 * 1024 * 1024);
  });

  it('should cut at a newline boundary', () => {
    const line = 'A'.repeat(100) + '\n';
    const repeatCount = Math.ceil((6 * 1024 * 1024) / line.length);
    fs.writeFileSync(logFile, line.repeat(repeatCount));

    truncateLogFile(logFile);

    const result = fs.readFileSync(logFile, 'utf-8');
    // Should not start mid-line
    expect(result.startsWith('A')).toBe(true);
    // Every line should be intact
    const lines = result.split('\n').filter(l => l.length > 0);
    for (const l of lines) {
      expect(l).toBe('A'.repeat(100));
    }
  });

  it('should handle a non-existent file without throwing', () => {
    expect(() => truncateLogFile(path.join(tmpDir, 'does-not-exist.log'))).not.toThrow();
  });
});

describe('setupDebugLogging', () => {
  let tmpDir: string;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-log-test-'));
    vi.stubEnv('MASTRA_DEBUG', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.error = originalError;
    console.warn = originalWarn;
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should silence console.error and console.warn when MASTRA_DEBUG is not set', () => {
    setupDebugLogging();

    // They should be no-ops — calling them should not throw
    expect(() => console.error('test')).not.toThrow();
    expect(() => console.warn('test')).not.toThrow();

    // Verify they are no longer the originals
    expect(console.error).not.toBe(originalError);
    expect(console.warn).not.toBe(originalWarn);
  });

  it('should silence console when MASTRA_DEBUG=false', () => {
    vi.stubEnv('MASTRA_DEBUG', 'false');
    setupDebugLogging();
    expect(console.error).not.toBe(originalError);
    expect(console.warn).not.toBe(originalWarn);
  });

  it('should redirect console.error and console.warn to file when MASTRA_DEBUG=true', async () => {
    vi.stubEnv('MASTRA_DEBUG', 'true');
    // Point getAppDataDir to our tmp dir
    const projectMod = await import('../project.js');
    vi.spyOn(projectMod, 'getAppDataDir').mockReturnValue(tmpDir);

    setupDebugLogging();

    console.error('test error message');
    console.error(new Error('test stack path'));
    console.warn('test warn message');

    // Give the write stream a moment to flush
    await new Promise(r => setTimeout(r, 100));

    const logFile = path.join(tmpDir, 'debug.log');
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('[ERROR]');
    expect(content).toContain('test error message');
    expect(content).toContain('Error: test stack path');
    expect(content).toContain('[WARN]');
    expect(content).toContain('test warn message');
  });

  it('should redirect console.error and console.warn to file when MASTRA_DEBUG=1', async () => {
    vi.stubEnv('MASTRA_DEBUG', '1');
    const projectMod = await import('../project.js');
    vi.spyOn(projectMod, 'getAppDataDir').mockReturnValue(tmpDir);

    setupDebugLogging();

    console.error('test error via 1');

    await new Promise(r => setTimeout(r, 100));

    const logFile = path.join(tmpDir, 'debug.log');
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('[ERROR]');
    expect(content).toContain('test error via 1');
  });
});
