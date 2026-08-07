/**
 * Tests for packages/core/src/agent/durable/run-registry.ts
 *
 * RunRegistry and ExtendedRunRegistry are the in-process store for
 * non-serializable durable-agent state (tools, model, save-queue,
 * message-list). The tests exercise real Map-based CRUD behaviour,
 * cleanup callback invocation, size/runIds accounting, and the
 * override lifecycle in ExtendedRunRegistry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtendedRunRegistry, RunRegistry } from './run-registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<Record<string, any>> = {}): any {
  return {
    tools: { search: { execute: vi.fn() } },
    model: { provider: 'openai', modelId: 'gpt-4o' } as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RunRegistry
// ---------------------------------------------------------------------------

describe('RunRegistry', () => {
  let registry: RunRegistry;

  beforeEach(() => {
    registry = new RunRegistry();
  });

  // --- register / get ---

  it('registers an entry and retrieves it by runId', () => {
    const entry = makeEntry();
    registry.register('run-1', entry);
    expect(registry.get('run-1')).toBe(entry);
  });

  it('returns undefined for an unknown runId', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('overwrites a previous entry when the same runId is re-registered', () => {
    const first = makeEntry({ model: { modelId: 'gpt-3.5' } });
    const second = makeEntry({ model: { modelId: 'gpt-4o' } });
    registry.register('run-1', first);
    registry.register('run-1', second);
    expect(registry.get('run-1')).toBe(second);
  });

  it('calls cleanup on the old entry before overwriting', () => {
    const cleanupFn = vi.fn();
    registry.register('run-1', makeEntry({ cleanup: cleanupFn }));
    registry.register('run-1', makeEntry());
    expect(cleanupFn).toHaveBeenCalledOnce();
  });

  // --- has ---

  it('has() returns true for a registered run', () => {
    registry.register('run-1', makeEntry());
    expect(registry.has('run-1')).toBe(true);
  });

  it('has() returns false for an unknown run', () => {
    expect(registry.has('missing')).toBe(false);
  });

  // --- getTools ---

  it('getTools() returns the tools for a registered run', () => {
    const tools = { search: { execute: vi.fn() } };
    registry.register('run-1', makeEntry({ tools }));
    expect(registry.getTools('run-1')).toBe(tools);
  });

  it('getTools() returns an empty object for an unknown run', () => {
    expect(registry.getTools('unknown')).toEqual({});
  });

  // --- getSaveQueueManager ---

  it('getSaveQueueManager() returns the manager when present', () => {
    const sqm = { flush: vi.fn() } as any;
    registry.register('run-1', makeEntry({ saveQueueManager: sqm }));
    expect(registry.getSaveQueueManager('run-1')).toBe(sqm);
  });

  it('getSaveQueueManager() returns undefined for missing entry', () => {
    expect(registry.getSaveQueueManager('unknown')).toBeUndefined();
  });

  // --- getModel ---

  it('getModel() returns the model for a registered run', () => {
    const model = { provider: 'anthropic', modelId: 'claude-3' } as any;
    registry.register('run-1', makeEntry({ model }));
    expect(registry.getModel('run-1')).toBe(model);
  });

  it('getModel() returns undefined for an unknown run', () => {
    expect(registry.getModel('unknown')).toBeUndefined();
  });

  // --- cleanup ---

  it('cleanup() removes the entry from the registry', () => {
    registry.register('run-1', makeEntry());
    registry.cleanup('run-1');
    expect(registry.has('run-1')).toBe(false);
  });

  it('cleanup() calls entry.cleanup if provided', () => {
    const cleanupFn = vi.fn();
    registry.register('run-1', makeEntry({ cleanup: cleanupFn }));
    registry.cleanup('run-1');
    expect(cleanupFn).toHaveBeenCalledOnce();
  });

  it('cleanup() is a no-op for an unknown runId (does not throw)', () => {
    expect(() => registry.cleanup('nonexistent')).not.toThrow();
  });

  it('cleanup() does not call cleanup when entry has no cleanup fn', () => {
    const entry = makeEntry(); // no cleanup property
    registry.register('run-1', entry);
    expect(() => registry.cleanup('run-1')).not.toThrow();
  });

  // --- size ---

  it('size is 0 for a fresh registry', () => {
    expect(registry.size).toBe(0);
  });

  it('size increments when entries are added', () => {
    registry.register('run-1', makeEntry());
    registry.register('run-2', makeEntry());
    expect(registry.size).toBe(2);
  });

  it('size decrements when an entry is cleaned up', () => {
    registry.register('run-1', makeEntry());
    registry.cleanup('run-1');
    expect(registry.size).toBe(0);
  });

  it('size does not change when the same runId is re-registered', () => {
    registry.register('run-1', makeEntry());
    registry.register('run-1', makeEntry());
    expect(registry.size).toBe(1);
  });

  // --- runIds ---

  it('runIds returns all registered run IDs', () => {
    registry.register('run-a', makeEntry());
    registry.register('run-b', makeEntry());
    expect(registry.runIds).toEqual(expect.arrayContaining(['run-a', 'run-b']));
    expect(registry.runIds).toHaveLength(2);
  });

  it('runIds returns empty array for a fresh registry', () => {
    expect(registry.runIds).toEqual([]);
  });

  // --- clear ---

  it('clear() removes all entries', () => {
    registry.register('run-1', makeEntry());
    registry.register('run-2', makeEntry());
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('clear() calls cleanup on every entry', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    registry.register('run-1', makeEntry({ cleanup: fn1 }));
    registry.register('run-2', makeEntry({ cleanup: fn2 }));
    registry.clear();
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('clear() is safe on an empty registry', () => {
    expect(() => registry.clear()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ExtendedRunRegistry
// ---------------------------------------------------------------------------

describe('ExtendedRunRegistry', () => {
  let registry: ExtendedRunRegistry;

  beforeEach(() => {
    registry = new ExtendedRunRegistry();
  });

  const fakeMessageList = { messages: [] } as any;

  // --- registerWithMessageList ---

  it('stores and retrieves a MessageList by runId', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    expect(registry.getMessageList('run-1')).toBe(fakeMessageList);
  });

  it('returns undefined MessageList for unknown runId', () => {
    expect(registry.getMessageList('unknown')).toBeUndefined();
  });

  it('stores and retrieves memoryInfo by runId', () => {
    const memoryInfo = { threadId: 't-1', resourceId: 'r-1' };
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList, memoryInfo);
    expect(registry.getMemoryInfo('run-1')).toEqual(memoryInfo);
  });

  it('returns undefined memoryInfo when not provided', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    expect(registry.getMemoryInfo('run-1')).toBeUndefined();
  });

  it('still stores the base entry accessible via get()', () => {
    const entry = makeEntry();
    registry.registerWithMessageList('run-1', entry, fakeMessageList);
    expect(registry.get('run-1')).toBe(entry);
  });

  // --- cleanup override ---

  it('cleanup() removes the MessageList', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    registry.cleanup('run-1');
    expect(registry.getMessageList('run-1')).toBeUndefined();
  });

  it('cleanup() removes the memoryInfo', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList, { threadId: 't-1' });
    registry.cleanup('run-1');
    expect(registry.getMemoryInfo('run-1')).toBeUndefined();
  });

  it('cleanup() still calls super cleanup (removes base entry)', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    registry.cleanup('run-1');
    expect(registry.has('run-1')).toBe(false);
  });

  // --- clear override ---

  it('clear() removes all MessageLists', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    registry.registerWithMessageList('run-2', makeEntry(), { messages: ['x'] } as any);
    registry.clear();
    expect(registry.getMessageList('run-1')).toBeUndefined();
    expect(registry.getMessageList('run-2')).toBeUndefined();
  });

  it('clear() removes all memoryInfo', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList, { threadId: 't-1' });
    registry.clear();
    expect(registry.getMemoryInfo('run-1')).toBeUndefined();
  });

  it('clear() removes all base entries', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    registry.clear();
    expect(registry.size).toBe(0);
  });

  // --- size inherited from RunRegistry ---

  it('size reflects entries registered via registerWithMessageList', () => {
    registry.registerWithMessageList('run-1', makeEntry(), fakeMessageList);
    registry.registerWithMessageList('run-2', makeEntry(), fakeMessageList);
    expect(registry.size).toBe(2);
  });
});
