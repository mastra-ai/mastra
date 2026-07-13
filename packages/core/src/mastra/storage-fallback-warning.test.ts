/**
 * Tests for the deferred "no storage configured" fallback warning.
 *
 * The warning is emitted on a microtask instead of eagerly in the constructor
 * so that file-based routing — which does `new Mastra({})` and then
 * synchronously calls `__registerFsStorage(...)` — can register a valid
 * `storage.ts` before the warning would fire. See the constructor in
 * `./index.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../logger';
import { InMemoryStore } from '../storage';
import { Mastra } from './index';

const FALLBACK = 'No `storage` configured on Mastra';

function warnSpyLogger() {
  const logger = new ConsoleLogger({ name: 'test', level: 'error' });
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  return { logger, warn };
}

const flushMicrotasks = () => Promise.resolve();

describe('Mastra in-memory storage fallback warning', () => {
  it('warns when no storage is configured', async () => {
    const { logger, warn } = warnSpyLogger();
    new Mastra({ logger });

    await flushMicrotasks();

    expect(warn.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes(FALLBACK))).toBe(true);
  });

  it('does not warn when file-based storage registers synchronously after construction', async () => {
    const { logger, warn } = warnSpyLogger();
    const mastra = new Mastra({ logger });

    // Mirrors the generated fs-routing entry: construct, then register.
    mastra.__registerFsStorage(new InMemoryStore());

    await flushMicrotasks();

    expect(warn.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes(FALLBACK))).toBe(false);
  });

  it('does not warn when storage is passed explicitly to the constructor', async () => {
    const { logger, warn } = warnSpyLogger();
    new Mastra({ logger, storage: new InMemoryStore() });

    await flushMicrotasks();

    expect(warn.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes(FALLBACK))).toBe(false);
  });
});
