import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { MastraCompositeStore } from '../../storage/base';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import type { Workspace } from '../../workspace';
import type { HarnessConfig } from './config';
import {
  HarnessConfigError,
  HarnessModelNotFoundError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessThreadNotFoundError,
  HarnessValidationError,
  HarnessWorkspaceProviderMismatchError,
} from './errors';
import { snapshotHarnessEventForJson } from './events';
import { Harness } from './harness';
import { nonDurableProvider } from './workspace-provider';

function makeAgent(name = 'default') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function makeStorage() {
  return new InMemoryHarness({ db: new InMemoryDB() });
}

class LeaseStealingStorage extends InMemoryHarness {
  private stolen = false;

  override async acquireSessionLease(opts: Parameters<InMemoryHarness['acquireSessionLease']>[0]) {
    if (!this.stolen) {
      this.stolen = true;
      await super.acquireSessionLease({ ...opts, ownerId: 'other-owner' });
    }
    return super.acquireSessionLease(opts);
  }
}

class FailingAttachmentStorage extends InMemoryHarness {
  failSaveAttachment = false;
  failDeleteAttachment = false;

  override async saveAttachment(opts: Parameters<InMemoryHarness['saveAttachment']>[0]) {
    if (this.failSaveAttachment) throw new Error('save attachment failed');
    return super.saveAttachment(opts);
  }

  override async deleteAttachment(opts: Parameters<InMemoryHarness['deleteAttachment']>[0]) {
    if (this.failDeleteAttachment) throw new Error('delete attachment failed');
    return super.deleteAttachment(opts);
  }
}

function makeHarness(overrides: Partial<HarnessConfig> = {}) {
  const storage = overrides.sessions?.storage ?? makeStorage();
  return new Harness({
    agents: { default: makeAgent() },
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
    ...overrides,
  });
}

describe('Harness v1 construction', () => {
  it('accepts a valid config and mints a process owner id', () => {
    const harness = makeHarness();
    const other = makeHarness();

    expect(harness.id).toBe(harness.ownerId);
    expect(harness.ownerId).toMatch(/^harness-/);
    expect(harness.ownerId).not.toBe(other.ownerId);
    expect(harness.getMastra()).toBeDefined();
    expect(harness.listModes()).toHaveLength(1);
  });

  it('exposes status-quo resource identity helpers', async () => {
    const harness = makeHarness({ id: 'mastra-code', resourceId: 'project-a' });

    expect(harness.getDefaultResourceId()).toBe('project-a');
    await harness.threads.create({ resourceId: 'project-b', threadId: 'thread-b' });
    await harness.threads.create({ resourceId: 'project-a', threadId: 'thread-a' });

    await expect(harness.getKnownResourceIds()).resolves.toEqual(['project-a', 'project-b']);
  });

  it('validates mode and agent wiring up front', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'missing' }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [
            { id: 'default', agentId: 'default' },
            { id: 'default', agentId: 'default' },
          ],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default' }],
          defaultModeId: 'missing',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('validates mode transitions and tool overlay shape', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default', transitionsTo: 'missing' }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default', tools: {}, additionalTools: {} }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('requires defaultModeId when modes are declared', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default' }],
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('validates attachment limit configuration up front', () => {
    expect(() =>
      makeHarness({
        files: { maxAttachmentBytes: 0 },
      }),
    ).toThrow(HarnessConfigError);

    expect(() =>
      makeHarness({
        files: { allowedContentTypes: ['text/plain', 'image/*'] },
      }),
    ).not.toThrow();

    expect(() =>
      makeHarness({
        files: { allowedContentTypes: [''] },
      }),
    ).toThrow(HarnessConfigError);
  });
});

describe('Harness.attachments', () => {
  it('uploads attachments with digest metadata and deletes them by attachment id', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const source = Buffer.from('hello attachment');
    const expectedSha256 = createHash('sha256').update(source).digest('hex');

    const result = await harness.attachments.upload({
      sessionId: session.id,
      data: source,
      filename: 'note.txt',
      contentType: 'text/plain',
    });

    expect(result).toMatchObject({
      resourceId: 'u',
      ownerSessionId: session.id,
      bytes: source.length,
      sha256: expectedSha256,
      source: 'preupload',
      kind: 'file',
      name: 'note.txt',
      mimeType: 'text/plain',
    });

    source[0] = 'j'.charCodeAt(0);
    await expect(storage.loadAttachment({ sessionId: session.id, attachmentId: result.attachmentId })).resolves.toEqual(
      expect.objectContaining({
        name: 'note.txt',
        mimeType: 'text/plain',
        bytes: Buffer.byteLength('hello attachment'),
        sha256: expectedSha256,
        data: new Uint8Array(Buffer.from('hello attachment')),
        semantic: { kind: 'file' },
      }),
    );

    await harness.attachments.delete({ attachmentId: result.attachmentId, sessionId: session.id });
    await expect(
      storage.loadAttachment({ sessionId: session.id, attachmentId: result.attachmentId }),
    ).resolves.toBeNull();
  });

  it('uploads arbitrary binary files such as images, videos, and documents', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const inputs = [
      { filename: 'diagram.png', contentType: 'image/png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
      { filename: 'clip.mp4', contentType: 'video/mp4', data: new Uint8Array([0x00, 0x00, 0x00, 0x18]) },
      { filename: 'brief.pdf', contentType: 'application/pdf', data: Buffer.from('%PDF-1.7') },
      {
        filename: 'notes.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      },
    ];

    for (const input of inputs) {
      const result = await harness.attachments.upload({ sessionId: session.id, ...input });
      const expected = createHash('sha256').update(input.data).digest('hex');

      expect(result).toMatchObject({
        name: input.filename,
        mimeType: input.contentType,
        kind: 'file',
        bytes: input.data.byteLength,
        sha256: expected,
      });
      await expect(
        storage.loadAttachment({ sessionId: session.id, attachmentId: result.attachmentId }),
      ).resolves.toEqual(
        expect.objectContaining({
          name: input.filename,
          mimeType: input.contentType,
          data: new Uint8Array(input.data),
        }),
      );
    }
  });

  it('enforces configured attachment size and content type limits', async () => {
    const storage = makeStorage();
    const harness = makeHarness({
      sessions: { storage },
      files: { maxAttachmentBytes: 64, allowedContentTypes: ['image/*', 'application/json'] },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        data: new Uint8Array(65),
        filename: 'too-big.png',
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().data' });

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        data: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(32));
            controller.enqueue(new Uint8Array(33));
            controller.close();
          },
        }),
        filename: 'too-big-stream.png',
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().data' });

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        data: new Uint8Array([1]),
        filename: 'note.txt',
        contentType: 'text/plain',
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().contentType' });

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'flags',
        primitiveType: 'custom.agentic.value',
        value: { ok: true },
      }),
    ).resolves.toMatchObject({ mimeType: 'application/json', primitiveType: 'custom.agentic.value' });
  });

  it('uploads primitive attachments as canonical bytes with semantic metadata', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await harness.attachments.upload({
      sessionId: session.id,
      kind: 'primitive',
      name: 'selection.json',
      primitiveType: 'selection',
      value: { z: 1, a: ['paper-1', 'paper-2'] },
      metadata: { label: 'Selected papers' },
    });

    const expectedBytes = Buffer.from('{"a":["paper-1","paper-2"],"z":1}');
    expect(result).toMatchObject({
      resourceId: 'u',
      ownerSessionId: session.id,
      kind: 'primitive',
      name: 'selection.json',
      mimeType: 'application/json',
      primitiveType: 'selection',
      metadata: { label: 'Selected papers' },
      bytes: expectedBytes.length,
      sha256: createHash('sha256').update(expectedBytes).digest('hex'),
    });

    const loaded = await storage.loadAttachment({ sessionId: session.id, attachmentId: result.attachmentId });
    expect(Buffer.from(loaded!.data).toString()).toBe('{"a":["paper-1","paper-2"],"z":1}');
    expect(loaded?.semantic).toMatchObject({ kind: 'primitive', primitiveType: 'selection' });
  });

  it('preserves JSON keys that would otherwise mutate object prototypes', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const value = JSON.parse('{"__proto__":{"x":1},"a":2}') as Record<string, unknown>;

    const result = await harness.attachments.upload({
      sessionId: session.id,
      kind: 'primitive',
      name: 'proto.json',
      primitiveType: 'json',
      value: value as never,
    });

    const loaded = await storage.loadAttachment({ sessionId: session.id, attachmentId: result.attachmentId });
    expect(Buffer.from(loaded!.data).toString()).toBe('{"__proto__":{"x":1},"a":2}');
  });

  it('rejects invalid primitive and element attachment JSON payloads', async () => {
    const harness = makeHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const cyclicPrimitive: Record<string, unknown> = { title: 'loop' };
    cyclicPrimitive.self = cyclicPrimitive;
    const cyclicElement: unknown[] = [];
    cyclicElement.push(cyclicElement);
    const sparsePrimitive: unknown[] = [];
    sparsePrimitive[1] = 'missing zero';

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'loop.json',
        primitiveType: 'json',
        value: cyclicPrimitive as never,
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().value.self' });
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'element',
        name: 'loop-element.json',
        elementType: 'loop',
        payload: cyclicElement as never,
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().payload[0]' });
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'sparse.json',
        primitiveType: 'json',
        value: sparsePrimitive as never,
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().value[0]' });
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        data: new Uint8Array([1]),
        filename: 'metadata.bin',
        contentType: 'application/octet-stream',
        metadata: ['not-a-record'] as never,
      }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'null-metadata.json',
        primitiveType: 'json',
        value: {},
        metadata: null as never,
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().metadata' });
  });

  it('accepts custom primitive attachment types and rejects missing ones', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const uploaded = await harness.attachments.upload({
      sessionId: session.id,
      kind: 'primitive',
      name: 'agent-card.json',
      primitiveType: 'agent-card',
      value: { agentId: 'researcher' },
    });

    expect(uploaded).toMatchObject({ primitiveType: 'agent-card' });
    await expect(
      storage.loadAttachment({ sessionId: session.id, attachmentId: uploaded.attachmentId }),
    ).resolves.toEqual(
      expect.objectContaining({
        semantic: expect.objectContaining({ primitiveType: 'agent-card' }),
      }),
    );
  });

  it('rejects primitive attachments with missing primitive types', async () => {
    const harness = makeHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'missing-type.json',
        primitiveType: undefined as never,
        value: {},
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().primitiveType' });
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        kind: 'primitive',
        name: 'empty-type.json',
        primitiveType: '' as never,
        value: {},
      }),
    ).rejects.toMatchObject({ field: 'attachments.upload().primitiveType' });
  });

  it('wraps attachment storage failures with harness storage errors', async () => {
    const storage = new FailingAttachmentStorage({ db: new InMemoryDB() });
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    storage.failSaveAttachment = true;
    await expect(
      harness.attachments.upload({
        sessionId: session.id,
        data: new Uint8Array([1]),
        filename: 'fail.bin',
        contentType: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({
      sessionId: session.id,
      operation: 'attachment',
      cause: expect.any(Error),
    });

    storage.failSaveAttachment = false;
    const uploaded = await harness.attachments.upload({
      sessionId: session.id,
      data: new Uint8Array([1]),
      filename: 'ok.bin',
      contentType: 'application/octet-stream',
    });

    storage.failDeleteAttachment = true;
    await expect(
      harness.attachments.delete({ sessionId: session.id, attachmentId: uploaded.attachmentId }),
    ).rejects.toBeInstanceOf(HarnessStorageError);
    await expect(
      harness.attachments.delete({ sessionId: session.id, attachmentId: uploaded.attachmentId }),
    ).rejects.toMatchObject({ sessionId: session.id, operation: 'attachment' });
  });

  it('uses the explicit owning session instead of the most recent resource session', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const older = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const newer = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await harness.attachments.upload({
      sessionId: older.id,
      resourceId: 'u',
      data: new Uint8Array([1, 2, 3]),
      filename: 'older.bin',
      contentType: 'application/octet-stream',
    });

    await expect(
      storage.getAttachmentRecord({ sessionId: older.id, attachmentId: result.attachmentId }),
    ).resolves.toMatchObject({
      ownerSessionId: older.id,
    });
    await expect(
      storage.getAttachmentRecord({ sessionId: newer.id, attachmentId: result.attachmentId }),
    ).resolves.toBeNull();

    await harness.attachments.delete({ sessionId: older.id, attachmentId: result.attachmentId });
    await expect(
      storage.getAttachmentRecord({ sessionId: older.id, attachmentId: result.attachmentId }),
    ).resolves.toBeNull();
  });

  it('requires the attachment caller to hold or acquire the session lease', async () => {
    const storage = makeStorage();
    const ownerHarness = makeHarness({ sessions: { storage } });
    const competingHarness = makeHarness({ sessions: { storage } });
    const session = await ownerHarness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(
      competingHarness.attachments.upload({
        sessionId: session.id,
        data: new Uint8Array([1]),
        filename: 'locked.bin',
        contentType: 'application/octet-stream',
      }),
    ).rejects.toBeInstanceOf(HarnessSessionLockedError);

    await ownerHarness.shutdown();
    const uploaded = await competingHarness.attachments.upload({
      sessionId: session.id,
      data: new Uint8Array([1]),
      filename: 'released.bin',
      contentType: 'application/octet-stream',
    });

    await expect(
      storage.getAttachmentRecord({ sessionId: session.id, attachmentId: uploaded.attachmentId }),
    ).resolves.toMatchObject({ name: 'released.bin' });
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({
      ownerId: undefined,
      leaseExpiresAt: undefined,
    });
  });
});

describe('Harness v1 session resolution', () => {
  let storage: InMemoryHarness;
  let harness: Harness;

  beforeEach(() => {
    storage = makeStorage();
    harness = makeHarness({ sessions: { storage } });
  });

  it('creates and reuses a live session for a caller-supplied thread', async () => {
    const first = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    const second = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });

    expect(second).toBe(first);
    expect(first.id).toMatch(/^sess-/);
    expect(first.threadId).toBe('thread-a');
    expect(first.resourceId).toBe('resource-a');
    expect(first.lifecycleState).toBe('live');
    expect(first.getRecord().ownsThread).toBe(false);
  });

  it('rejects caller-supplied thread ids already owned by another resource', async () => {
    await harness.threads.create({ resourceId: 'resource-a', threadId: 'thread-a' });

    await expect(harness.session({ resourceId: 'resource-b', threadId: 'thread-a' })).rejects.toThrow(
      HarnessConfigError,
    );
    await expect(harness.listSessions({ resourceId: 'resource-b' })).resolves.toHaveLength(0);
  });

  it('coalesces concurrent first resolution for the same caller-supplied thread', async () => {
    const [first, second] = await Promise.all([
      harness.session({ threadId: 'thread-a', resourceId: 'resource-a' }),
      harness.session({ threadId: 'thread-a', resourceId: 'resource-a' }),
    ]);

    expect(first).toBe(second);
    await expect(harness.listSessions({ resourceId: 'resource-a' })).resolves.toHaveLength(1);
  });

  it('hydrates the requested session when multiple sessions share a thread', async () => {
    const first = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a', sessionId: 'session-a' });
    await harness.session({ resourceId: 'resource-a', threadId: 'thread-a', sessionId: 'session-b' });
    await harness.shutdown();

    const nextHarness = makeHarness({ sessions: { storage } });
    const hydrated = await nextHarness.session({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      sessionId: first.id,
    });

    expect(hydrated.id).toBe(first.id);
    expect(hydrated.threadId).toBe('thread-a');
  });

  it('coalesces concurrent resource-only creation', async () => {
    const [first, second] = await Promise.all([
      harness.session({ resourceId: 'resource-a' }),
      harness.session({ resourceId: 'resource-a' }),
    ]);

    expect(first).toBe(second);
    await expect(harness.listSessions({ resourceId: 'resource-a' })).resolves.toHaveLength(1);
  });

  it('applies configured initial state to each new session', async () => {
    const initialized = makeHarness({
      initialState: () => ({ yolo: true, count: 1 }),
      sessions: { storage },
    });

    const first = await initialized.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    const second = await initialized.session({ threadId: 'thread-b', resourceId: 'resource-a' });

    expect(first.getRecord().state).toEqual({ yolo: true, count: 1 });
    expect(second.getRecord().state).toEqual({ yolo: true, count: 1 });
    expect(first.getRecord().state).not.toBe(second.getRecord().state);
  });

  it('uses resolveModel for fresh sessions when no model override is provided', async () => {
    const resolveModel: NonNullable<HarnessConfig['resolveModel']> = vi.fn(async ({ modeId, agentId, resourceId }) => {
      expect(modeId).toBe('default');
      expect(agentId).toBe('default');
      expect(resourceId).toBe('resource-a');
      return 'openai/gpt-4o-mini';
    });
    const resolved = makeHarness({ resolveModel });

    const session = await resolved.session({ threadId: 'thread-a', resourceId: 'resource-a' });

    expect(resolveModel).toHaveBeenCalledTimes(1);
    expect(session.modelId).toBe('openai/gpt-4o-mini');
    expect(session.getRecord().modelId).toBe('openai/gpt-4o-mini');
  });

  it('mints a fresh thread and owning session when requested', async () => {
    const first = await harness.session({ threadId: { fresh: true }, resourceId: 'resource-a' });
    const second = await harness.session({ threadId: { fresh: true }, resourceId: 'resource-a' });

    expect(first.threadId).toMatch(/^thread-/);
    expect(second.threadId).toMatch(/^thread-/);
    expect(first.threadId).not.toBe(second.threadId);
    expect(first.getRecord().ownsThread).toBe(true);
    await expect(harness.threads.get({ resourceId: 'resource-a', threadId: first.threadId })).resolves.toMatchObject({
      id: first.threadId,
      resourceId: 'resource-a',
    });
  });

  it('hydrates the newest active session for resource-only resolution', async () => {
    const session = await harness.session({ resourceId: 'resource-a' });
    await harness.shutdown();

    const nextHarness = makeHarness({ sessions: { storage } });
    const hydrated = await nextHarness.session({ resourceId: 'resource-a' });

    expect(hydrated.id).toBe(session.id);
    expect(hydrated).not.toBe(session);
  });

  it('re-reads the session after acquiring a hydrate lease', async () => {
    const session = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a' });
    await harness.shutdown();
    const stale = { ...(await storage.loadSession({ sessionId: session.id }))! };

    await storage.saveSession(
      {
        ...stale,
        state: { persistedAfterInitialRead: true },
      },
      { ownerId: 'external-owner', ifVersion: stale.version },
    );

    const originalLoadSessionByThread = storage.loadSessionByThread.bind(storage);
    vi.spyOn(storage, 'loadSessionByThread')
      .mockResolvedValueOnce(stale)
      .mockImplementation(originalLoadSessionByThread);

    const nextHarness = makeHarness({ sessions: { storage } });
    const hydrated = await nextHarness.session({ resourceId: 'resource-a', threadId: 'thread-a' });

    expect(hydrated.getRecord().state).toEqual({ persistedAfterInitialRead: true });
  });

  it('coalesces concurrent hydrations for the same durable session', async () => {
    const session = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    await harness.shutdown();

    const nextHarness = makeHarness({ sessions: { storage } });
    const [first, second] = await Promise.all([
      nextHarness.session({ sessionId: session.id }),
      nextHarness.session({ sessionId: session.id }),
    ]);

    expect(first).toBe(second);
    expect(nextHarness._internalLiveSessionCount()).toBe(1);
  });

  it('resolves by session id and enforces resource scoping', async () => {
    const created = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });

    await expect(harness.session({ sessionId: 'missing' })).rejects.toThrow(HarnessSessionNotFoundError);
    await expect(harness.session({ sessionId: created.id, resourceId: 'resource-b' })).rejects.toThrow(
      HarnessSessionNotFoundError,
    );
    await expect(harness.session({ sessionId: created.id, resourceId: 'resource-a' })).resolves.toBe(created);
  });

  it('creates a new active session after the previous one closes', async () => {
    const first = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    await first.close();

    await expect(harness.session({ sessionId: first.id })).rejects.toThrow(HarnessSessionClosedError);
    const second = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });

    expect(second.id).not.toBe(first.id);
    expect(second.threadId).toBe('thread-a');
  });

  it('surfaces a lock conflict when another harness owns the lease', async () => {
    const first = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    const competingHarness = makeHarness({ sessions: { storage } });

    await expect(competingHarness.session({ sessionId: first.id })).rejects.toThrow(HarnessSessionLockedError);
  });

  it('renews the live session lease before another harness can take it', async () => {
    vi.useFakeTimers();
    const ownerHarness = makeHarness({ sessions: { storage, leaseTtlMs: 25 } });
    try {
      const session = await ownerHarness.session({
        threadId: 'thread-a',
        resourceId: 'resource-a',
      });
      const firstLeaseExpiresAt = session.getRecord().leaseExpiresAt;
      const competingHarness = makeHarness({ sessions: { storage, leaseTtlMs: 25 } });

      await vi.advanceTimersByTimeAsync(13);

      await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({
        ownerId: ownerHarness.ownerId,
        leaseExpiresAt: expect.any(Number),
      });
      expect(session.getRecord().leaseExpiresAt).toBeGreaterThan(firstLeaseExpiresAt ?? 0);
      await expect(competingHarness.session({ sessionId: session.id })).rejects.toThrow(HarnessSessionLockedError);
    } finally {
      await ownerHarness.shutdown();
      vi.useRealTimers();
    }
  });

  it('does not delete a newly inserted session when another owner wins the lease race', async () => {
    const stealingStorage = new LeaseStealingStorage({ db: new InMemoryDB() });
    const racingHarness = makeHarness({ sessions: { storage: stealingStorage } });

    await expect(
      racingHarness.session({ threadId: 'thread-a', resourceId: 'resource-a', sessionId: 'session-a' }),
    ).rejects.toThrow(HarnessSessionLockedError);

    await expect(stealingStorage.loadSession({ sessionId: 'session-a' })).resolves.toMatchObject({
      id: 'session-a',
      ownerId: 'other-owner',
    });
  });

  it('keeps a fresh owned thread when another owner wins the session lease race', async () => {
    const stealingStorage = new LeaseStealingStorage({ db: new InMemoryDB() });
    const racingHarness = makeHarness({ sessions: { storage: stealingStorage } });

    await expect(
      racingHarness.session({ threadId: { fresh: true }, resourceId: 'resource-a', sessionId: 'session-a' }),
    ).rejects.toThrow(HarnessSessionLockedError);

    const threads = await racingHarness.threads.list({ resourceId: 'resource-a', perPage: false });
    const stored = await stealingStorage.loadSession({ sessionId: 'session-a' });

    expect(threads.threads).toHaveLength(1);
    expect(stored).toMatchObject({
      id: 'session-a',
      ownsThread: true,
      ownerId: 'other-owner',
      threadId: threads.threads[0]?.id,
    });
  });
});

describe('Harness v1 lifecycle and discovery', () => {
  it('lists sessions with closed records excluded by default', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });
    await session.close();

    await expect(harness.listSessions({ resourceId: 'resource-a' })).resolves.toEqual([]);
    const withClosed = await harness.listSessions({ resourceId: 'resource-a', includeClosed: true });

    expect(withClosed).toHaveLength(1);
    expect(withClosed[0]?.id).toBe(session.id);
    await expect(harness.loadSession({ sessionId: session.id })).resolves.toBeNull();
    await expect(harness.loadSession({ sessionId: session.id, includeClosed: true })).resolves.toMatchObject({
      id: session.id,
      closedAt: expect.any(Number),
    });
  });

  it('releases live leases on shutdown without closing records', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: 'thread-a', resourceId: 'resource-a' });

    await harness.shutdown();

    await expect(harness.session({ resourceId: 'resource-a' })).rejects.toThrow('Harness is shut down');
    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored?.closedAt).toBeUndefined();

    const nextHarness = makeHarness({ sessions: { storage } });
    await expect(nextHarness.session({ sessionId: session.id })).resolves.toMatchObject({ id: session.id });
  });

  it('finalizes a parent close when a child close fails', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a', sessionId: 'parent' });
    const child = await harness.session({
      resourceId: 'resource-a',
      threadId: 'thread-b',
      sessionId: 'child',
      parentSessionId: parent.id,
    });

    (harness as unknown as { _liveSessions: Map<string, unknown> })._liveSessions.delete(child.id);
    await storage.releaseSessionLease({ sessionId: child.id, ownerId: harness.ownerId });
    await storage.acquireSessionLease({ sessionId: child.id, ownerId: 'other-owner', ttlMs: 30_000 });

    await expect(parent.close()).rejects.toThrow(HarnessStorageError);
    expect(parent.lifecycleState).toBe('closed');
    await expect(harness.loadSession({ sessionId: parent.id, includeClosed: true })).resolves.toMatchObject({
      id: parent.id,
      closedAt: expect.any(Number),
    });
    await expect(harness.session({ sessionId: parent.id })).rejects.toThrow(HarnessSessionClosedError);
  });

  it('destroys shared workspaces on shutdown even when session storage is not configured', async () => {
    const workspace = {
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'shared', workspace },
    });

    await harness.getWorkspace();
    await harness.shutdown();

    expect(workspace.destroy).toHaveBeenCalledTimes(1);
    await expect(harness.getWorkspace()).rejects.toThrow('Harness is shut down');
    expect(workspace.init).toHaveBeenCalledTimes(1);
    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('emits serializable shared workspace status events without undefined optional fields', async () => {
    const workspace = {
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'shared', workspace },
    });
    const events: unknown[] = [];
    harness.subscribe(event => events.push(event));

    await harness.getWorkspace();

    const readyEvent = events.find(
      event =>
        (event as { type?: string; status?: string }).type === 'workspace_status_changed' &&
        (event as { status?: string }).status === 'ready',
    );
    expect(snapshotHarnessEventForJson(readyEvent)).toMatchObject({
      type: 'workspace_status_changed',
      status: 'ready',
    });
    expect(readyEvent).not.toHaveProperty('resourceId');
    expect(readyEvent).not.toHaveProperty('providerId');
  });

  it('destroys a shared workspace that finishes acquiring during shutdown', async () => {
    let release!: () => void;
    const workspace = {
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const harness = new Harness({
      modes: [],
      workspace: {
        kind: 'shared',
        workspace: vi.fn(async () => {
          await new Promise<void>(resolve => {
            release = resolve;
          });
          return workspace;
        }),
      },
    });

    const acquiring = harness.getWorkspace();
    await Promise.resolve();
    const shuttingDown = harness.shutdown();
    await Promise.resolve();
    expect(workspace.destroy).not.toHaveBeenCalled();

    release();
    await expect(acquiring).resolves.toBe(workspace);
    await shuttingDown;

    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys a per-resource workspace when initialization fails', async () => {
    const workspace = {
      status: 'pending',
      init: vi.fn(async () => {
        throw new Error('init failed');
      }),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const provider = {
      providerId: 'resource-provider',
      resumable: false,
      create: vi.fn(async () => workspace),
      destroy: vi.fn(async (created: Workspace) => {
        await created.destroy();
      }),
    };
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'per-resource', provider },
    });

    await expect(harness._workspaceRegistry.acquirePerResource({ resourceId: 'resource-a' })).rejects.toThrow(
      'init failed',
    );

    expect(provider.destroy).toHaveBeenCalledWith(workspace, expect.objectContaining({ resourceId: 'resource-a' }));
    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys a per-session workspace when initialization fails', async () => {
    const workspace = {
      status: 'pending',
      init: vi.fn(async () => {
        throw new Error('init failed');
      }),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const provider = {
      providerId: 'session-provider',
      resumable: true,
      create: vi.fn(async () => workspace),
      resume: vi.fn(async () => workspace),
      destroy: vi.fn(async (created: Workspace) => {
        await created.destroy();
      }),
    };
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'per-session', provider },
    });

    await expect(
      harness._workspaceRegistry.acquirePerSession({
        resourceId: 'resource-a',
        sessionId: 'session-a',
        onStateUpdate: async () => undefined,
      }),
    ).rejects.toThrow('init failed');

    expect(provider.destroy).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({ resourceId: 'resource-a', sessionId: 'session-a' }),
    );
    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('awaits pending per-resource workspace acquisition during shutdown', async () => {
    let release!: () => void;
    const workspace = {
      status: 'ready',
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const harness = new Harness({
      modes: [],
      workspace: {
        kind: 'per-resource',
        provider: nonDurableProvider(async () => {
          await new Promise<void>(resolve => {
            release = resolve;
          });
          return workspace;
        }),
      },
    });

    const acquiring = harness._workspaceRegistry.acquirePerResource({ resourceId: 'resource-a' });
    await Promise.resolve();
    const shuttingDown = harness.shutdown();
    await Promise.resolve();
    expect(workspace.destroy).not.toHaveBeenCalled();

    release();
    await expect(acquiring).resolves.toBe(workspace);
    await shuttingDown;

    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('awaits pending per-session workspace acquisition during shutdown', async () => {
    let release!: () => void;
    const workspace = {
      status: 'ready',
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const provider = {
      providerId: 'session-provider',
      resumable: true,
      create: vi.fn(async () => {
        await new Promise<void>(resolve => {
          release = resolve;
        });
        return workspace;
      }),
      resume: vi.fn(async () => workspace),
    };
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'per-session', provider },
    });

    const acquiring = harness._workspaceRegistry.acquirePerSession({
      resourceId: 'resource-a',
      sessionId: 'session-a',
      onStateUpdate: async () => undefined,
    });
    await Promise.resolve();
    const shuttingDown = harness.shutdown();
    await Promise.resolve();
    expect(workspace.destroy).not.toHaveBeenCalled();

    release();
    await expect(acquiring).resolves.toBe(workspace);
    await shuttingDown;

    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not initialize an already ready shared workspace', async () => {
    const workspace = {
      status: 'ready',
      init: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const harness = new Harness({
      modes: [],
      workspace: { kind: 'shared', workspace },
    });

    await harness.getWorkspace();

    expect(workspace.init).not.toHaveBeenCalled();
  });

  it('coalesces concurrent per-resource workspace acquisition', async () => {
    const workspace = {
      status: 'pending',
      init: vi.fn(async function (this: { status: string }) {
        this.status = 'ready';
      }),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const create = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return workspace;
    });
    const harness = new Harness({
      modes: [],
      workspace: {
        kind: 'per-resource',
        provider: nonDurableProvider(create, { providerId: 'test-provider' }),
      },
    });

    const [first, second] = await Promise.all([
      harness._workspaceRegistry.acquirePerResource({ resourceId: 'resource-a' }),
      harness._workspaceRegistry.acquirePerResource({ resourceId: 'resource-a' }),
    ]);

    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
    await harness._workspaceRegistry.releasePerResource({ resourceId: 'resource-a' });
    expect(workspace.destroy).not.toHaveBeenCalled();
    await harness._workspaceRegistry.releasePerResource({ resourceId: 'resource-a' });
    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not resume per-session workspace state from a different provider', async () => {
    const create = vi.fn(async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace);
    const resume = vi.fn(async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace);
    const harness = new Harness({
      modes: [],
      workspace: {
        kind: 'per-session',
        provider: {
          providerId: 'current',
          resumable: true,
          create,
          resume,
        },
      },
    });

    await harness._workspaceRegistry.acquirePerSession({
      resourceId: 'resource-a',
      sessionId: 'session-a',
      storedProviderId: 'previous',
      storedState: { from: 'previous' },
      onStateUpdate: async () => undefined,
    });

    expect(resume).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent per-session workspace acquisition', async () => {
    const workspace = {
      status: 'pending',
      init: vi.fn(async function (this: { status: string }) {
        this.status = 'ready';
      }),
      destroy: vi.fn(async () => undefined),
    } as unknown as Workspace;
    const create = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return workspace;
    });
    const harness = new Harness({
      modes: [],
      workspace: {
        kind: 'per-session',
        provider: {
          providerId: 'session-provider',
          resumable: true,
          create,
          resume: async () => workspace,
        },
      },
    });

    const [first, second] = await Promise.all([
      harness._workspaceRegistry.acquirePerSession({
        resourceId: 'resource-a',
        sessionId: 'session-a',
        onStateUpdate: async () => undefined,
      }),
      harness._workspaceRegistry.acquirePerSession({
        resourceId: 'resource-a',
        sessionId: 'session-a',
        onStateUpdate: async () => undefined,
      }),
    ]);

    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
    await harness._workspaceRegistry.releasePerSession({ sessionId: 'session-a' });
    expect(workspace.destroy).toHaveBeenCalledTimes(1);
  });

  it('releases the session lease when workspace provider mismatch rejects hydration', async () => {
    const storage = makeStorage();
    const seedHarness = makeHarness({ sessions: { storage } });
    const session = await seedHarness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    await seedHarness.shutdown();

    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored).not.toBeNull();
    await storage.saveSession(
      { ...stored!, workspace: { providerId: 'previous', state: { branch: 'main' } } },
      { ownerId: 'seed', ifVersion: stored!.version },
    );

    const mismatched = makeHarness({
      sessions: { storage },
      workspace: {
        kind: 'per-session',
        provider: {
          providerId: 'current',
          resumable: true,
          create: async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace,
          resume: async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace,
        },
      },
    });
    await expect(mismatched.session({ sessionId: session.id })).rejects.toThrow(HarnessWorkspaceProviderMismatchError);

    const matching = makeHarness({
      sessions: { storage },
      workspace: {
        kind: 'per-session',
        provider: {
          providerId: 'previous',
          resumable: true,
          create: async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace,
          resume: async () => ({ status: 'ready', init: vi.fn(), destroy: vi.fn() }) as unknown as Workspace,
        },
      },
    });

    await expect(matching.session({ sessionId: session.id })).resolves.toMatchObject({ id: session.id });
    const after = await storage.loadSession({ sessionId: session.id });
    expect(after?.ownerId).toBe(matching.ownerId);
  });

  it('exposes model catalog and auth status resolution', async () => {
    const harness = makeHarness({
      models: [{ id: 'openai/gpt-4o-mini', providerId: 'openai', displayName: 'GPT-4o mini' }],
      modelAuthStatusResolver: async modelId => (modelId === 'openai/gpt-4o-mini' ? 'authenticated' : 'unknown'),
    });

    await expect(harness.models.list()).resolves.toHaveLength(1);
    await expect(harness.models.get('openai/gpt-4o-mini')).resolves.toMatchObject({ providerId: 'openai' });
    await expect(harness.models.getAuthStatus('openai/gpt-4o-mini')).resolves.toBe('authenticated');
    await expect(harness.models.getAuthStatus('missing')).rejects.toThrow(HarnessModelNotFoundError);
  });

  it('exposes legacy-compatible available model discovery hooks', async () => {
    const harness = makeHarness({
      models: [{ id: 'local-test/model-a', providerId: 'local-test', displayName: 'Model A' }],
      modelAuthChecker: provider => (provider === 'local-test' ? true : undefined),
      modelUseCountProvider: () => ({
        'local-test/model-a': 2,
        'custom/model-b': 5,
      }),
      customModelCatalogProvider: async () => [
        {
          id: 'custom/model-b',
          provider: 'custom',
          modelName: 'model-b',
          hasApiKey: true,
        },
      ],
    });

    const models = await harness.listAvailableModels();

    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-test/model-a',
          provider: 'local-test',
          modelName: 'model-a',
          hasApiKey: true,
          useCount: 2,
        }),
        expect.objectContaining({
          id: 'custom/model-b',
          provider: 'custom',
          modelName: 'model-b',
          hasApiKey: true,
          useCount: 5,
        }),
      ]),
    );
  });

  it('starts and stops process-local interval handlers', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn();
      const shutdown = vi.fn();
      const harness = makeHarness({
        id: 'interval-harness',
        intervals: [{ id: 'sync', everyMs: 10, handler, shutdown }],
      });

      await harness.init();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenLastCalledWith(
        expect.objectContaining({ harnessId: 'interval-harness', abortSignal: expect.any(AbortSignal) }),
      );

      vi.advanceTimersByTime(25);
      expect(handler).toHaveBeenCalledTimes(3);

      await harness.stopIntervals();
      expect(shutdown).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(20);
      expect(handler).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Harness v1 threads', () => {
  it('creates, lists, renames, settings, clones, and deletes resource-scoped threads', async () => {
    const harness = makeHarness();
    const created = await harness.threads.create({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      title: 'Initial',
      metadata: { pinned: true },
    });

    expect(created).toMatchObject({ id: 'thread-a', resourceId: 'resource-a', title: 'Initial' });
    await expect(harness.threads.get({ resourceId: 'resource-b', threadId: 'thread-a' })).resolves.toBeNull();

    const listed = await harness.threads.list({ resourceId: 'resource-a', perPage: false });
    expect(listed.threads).toHaveLength(1);
    expect(listed.items).toHaveLength(1);

    const renamed = await harness.threads.rename({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      title: 'Renamed',
      metadata: { color: 'blue' },
    });
    expect(renamed.title).toBe('Renamed');

    await harness.threads.setSettings({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      patch: { color: 'green', pinned: undefined },
    });
    await expect(
      harness.threads.getSetting({ resourceId: 'resource-a', threadId: 'thread-a', key: 'color' }),
    ).resolves.toBe('green');

    const cloned = await harness.threads.clone({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      newThreadId: 'thread-b',
      title: 'Clone',
    });
    expect(cloned).toMatchObject({ id: 'thread-b', title: 'Clone' });

    await expect(harness.threads.getSettings({ resourceId: 'resource-b', threadId: 'thread-a' })).rejects.toThrow(
      HarnessThreadNotFoundError,
    );

    await harness.threads.delete({ resourceId: 'resource-a', threadId: 'thread-a' });
    await expect(harness.threads.get({ resourceId: 'resource-a', threadId: 'thread-a' })).resolves.toBeNull();
  });

  it('rejects caller-supplied thread id collisions across resources', async () => {
    const harness = makeHarness();
    await harness.threads.create({ resourceId: 'resource-a', threadId: 'thread-a' });

    await expect(harness.threads.create({ resourceId: 'resource-b', threadId: 'thread-a' })).rejects.toThrow(
      HarnessConfigError,
    );
    await expect(harness.threads.get({ resourceId: 'resource-a', threadId: 'thread-a' })).resolves.toMatchObject({
      id: 'thread-a',
      resourceId: 'resource-a',
    });
  });

  it('rejects duplicate thread ids for the same resource', async () => {
    const harness = makeHarness();
    await harness.threads.create({
      resourceId: 'resource-a',
      threadId: 'thread-a',
      title: 'Original',
      metadata: { stable: true },
    });

    await expect(
      harness.threads.create({
        resourceId: 'resource-a',
        threadId: 'thread-a',
        title: 'Replacement',
        metadata: { stable: false },
      }),
    ).rejects.toThrow(HarnessConfigError);
    await expect(harness.threads.get({ resourceId: 'resource-a', threadId: 'thread-a' })).resolves.toMatchObject({
      title: 'Original',
      metadata: { stable: true },
    });
  });

  it('closes the live session before deleting its thread', async () => {
    const harness = makeHarness();
    await harness.threads.create({ resourceId: 'resource-a', threadId: 'thread-a' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a' });

    await harness.threads.delete({ resourceId: 'resource-a', threadId: 'thread-a' });

    expect(session.lifecycleState).toBe('closed');
    await expect(harness.session({ sessionId: session.id })).rejects.toThrow(HarnessSessionClosedError);
  });

  it('closes every active session for a deleted thread', async () => {
    const harness = makeHarness();
    await harness.threads.create({ resourceId: 'resource-a', threadId: 'thread-a' });
    const first = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a', sessionId: 'session-a' });
    const second = await harness.session({ resourceId: 'resource-a', threadId: 'thread-a', sessionId: 'session-b' });

    await harness.threads.delete({ resourceId: 'resource-a', threadId: 'thread-a' });

    expect(first.lifecycleState).toBe('closed');
    expect(second.lifecycleState).toBe('closed');
    await expect(harness.listSessions({ resourceId: 'resource-a' })).resolves.toEqual([]);
  });

  it('deletes memory threads even when the harness session storage domain is absent', async () => {
    const db = new InMemoryDB();
    const storage = new MastraCompositeStore({
      id: 'memory-only',
      domains: { memory: new InMemoryMemory({ db }) },
    });
    const harness = new Harness({
      agents: { default: makeAgent() },
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      storage,
    });

    await harness.threads.create({ resourceId: 'resource-a', threadId: 'thread-a' });
    await harness.threads.delete({ resourceId: 'resource-a', threadId: 'thread-a' });

    await expect(harness.threads.get({ resourceId: 'resource-a', threadId: 'thread-a' })).resolves.toBeNull();
  });
});
