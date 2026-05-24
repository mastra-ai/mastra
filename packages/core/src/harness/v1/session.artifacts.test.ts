/**
 * Harness v1 — artifacts public API tests.
 *
 *   - harness.artifacts.write computes hash/mime/bytes from the attachment
 *   - parentArtifactId increments version + carries lineageRootId
 *   - duplicate / lineage / version / attachment errors translate to typed
 *     public errors
 *   - capability-false adapter raises HarnessArtifactsUnsupportedError
 *     from all four surfaces
 *   - artifact_created event is emitted on the live session emitter and
 *     reaches harness-level subscribers via the bridge
 *   - list filters by artifactType and respects limit/cursor
 *   - versions() walks the lineage in version order
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { HarnessStorage } from '../../storage/domains/harness/base';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }
  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }
  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

async function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  const attachment = await harness.attachments.upload({
    sessionId: session.id,
    resourceId: session.resourceId,
    filename: 'diff.patch',
    contentType: 'text/x-diff',
    data: new TextEncoder().encode('--- a/x\n+++ b/x\n'),
  });
  return { harness, agent, storage, session, attachment };
}

describe('harness.artifacts.write', () => {
  it('creates v1 with hash/mime/bytes copied from the attachment', async () => {
    const { harness, session, attachment } = await setup();
    const record = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
      createdBy: { agentId: 'default' },
    });
    expect(record).toMatchObject({
      artifactId: 'a1',
      lineageRootId: 'a1',
      version: 1,
      mimeType: 'text/x-diff',
      bytes: 16,
      artifactType: 'diff',
      createdBy: { agentId: 'default' },
    });
    expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.parentArtifactId).toBeUndefined();
  });

  it('parentArtifactId carries lineageRootId and increments version', async () => {
    const { harness, session, attachment } = await setup();
    const v1 = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
    });
    const v2 = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a2',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
      parentArtifactId: v1.artifactId,
    });
    expect(v2).toMatchObject({
      lineageRootId: 'a1',
      parentArtifactId: 'a1',
      version: 2,
    });
  });

  it('emits artifact_created on the session emitter (reaches harness subscribers via bridge)', async () => {
    const { harness, session, attachment } = await setup();
    const sessionEvents: HarnessEvent[] = [];
    const harnessEvents: HarnessEvent[] = [];
    session.subscribe(e => sessionEvents.push(e));
    harness.subscribe(e => harnessEvents.push(e));
    const record = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'report',
      attachmentId: attachment.attachmentId,
    });
    const sessionEvent = sessionEvents.find(e => e.type === 'artifact_created') as any;
    const harnessEvent = harnessEvents.find(e => e.type === 'artifact_created') as any;
    expect(sessionEvent).toBeDefined();
    expect(harnessEvent).toBeDefined();
    expect(sessionEvent).toMatchObject({
      artifactId: 'a1',
      artifactType: 'report',
      lineageRootId: 'a1',
      version: 1,
      mimeType: 'text/x-diff',
      sha256: record.sha256,
      bytes: 16,
    });
    expect(harnessEvent.id).toBe(sessionEvent.id);
  });

  it('rejects duplicate artifactId with HarnessArtifactDuplicateIdError', async () => {
    const { harness, session, attachment } = await setup();
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
    });
    await expect(
      harness.artifacts.write({
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        artifactId: 'a1',
        artifactType: 'diff',
        attachmentId: attachment.attachmentId,
      }),
    ).rejects.toMatchObject({
      name: 'HarnessArtifactDuplicateIdError',
      code: 'harness.artifact_duplicate_id',
    });
  });

  it('rejects missing attachment with HarnessArtifactAttachmentMissingError', async () => {
    const { harness, session } = await setup();
    await expect(
      harness.artifacts.write({
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        artifactId: 'a1',
        artifactType: 'diff',
        attachmentId: 'never-uploaded',
      }),
    ).rejects.toMatchObject({
      name: 'HarnessArtifactAttachmentMissingError',
      code: 'harness.artifact_attachment_missing',
    });
  });

  it('rejects missing parent with HarnessArtifactLineageMismatchError', async () => {
    const { harness, session, attachment } = await setup();
    await expect(
      harness.artifacts.write({
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        artifactId: 'a2',
        artifactType: 'diff',
        attachmentId: attachment.attachmentId,
        parentArtifactId: 'never-written',
      }),
    ).rejects.toMatchObject({
      name: 'HarnessArtifactLineageMismatchError',
      code: 'harness.artifact_lineage_mismatch',
      reason: 'parent_missing',
    });
  });
});

describe('harness.artifacts read APIs', () => {
  it('get returns the record', async () => {
    const { harness, session, attachment } = await setup();
    const written = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
    });
    const fetched = await harness.artifacts.get({
      sessionId: session.id,
      resourceId: session.resourceId,
      artifactId: 'a1',
    });
    expect(fetched).toMatchObject({ artifactId: 'a1', sha256: written.sha256 });
  });

  it('get returns null when the artifact is in a different resource scope', async () => {
    const { harness, session, attachment } = await setup();
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'a1',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
    });
    const fetched = await harness.artifacts.get({
      sessionId: session.id,
      resourceId: 'other-resource',
      artifactId: 'a1',
    });
    expect(fetched).toBeNull();
  });

  it('list filters by artifactType', async () => {
    const { harness, session, attachment } = await setup();
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'plan-1',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
    });
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'diff-1',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
    });
    const plans = await harness.artifacts.list({
      sessionId: session.id,
      resourceId: session.resourceId,
      artifactType: 'plan',
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]!.artifactId).toBe('plan-1');
  });

  it('versions walks the lineage in version order from any anchor', async () => {
    const { harness, session, attachment } = await setup();
    const v1 = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'r1',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
    });
    const v2 = await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'r2',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
      parentArtifactId: v1.artifactId,
    });
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'r3',
      artifactType: 'plan',
      attachmentId: attachment.attachmentId,
      parentArtifactId: v2.artifactId,
    });
    const versions = await harness.artifacts.versions({
      sessionId: session.id,
      resourceId: session.resourceId,
      artifactId: 'r2',
    });
    expect(versions.map(v => v.version)).toEqual([1, 2, 3]);
  });
});

describe('harness.artifacts — session lifecycle', () => {
  it('artifact_created fires on harness emitter (sessionId override) when caller has no live Session bridge', async () => {
    // Cover the no-live-session branch in artifacts.write: storage write
    // succeeds, then the helper checks _liveSessions; if absent, it
    // dispatches the event directly on the harness emitter with a
    // sessionId override so harness-level subscribers still observe the
    // lifecycle. Trigger by closing the session before writing.
    const { harness, session, attachment } = await setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => events.push(e));
    const sessionId = session.id;
    const resourceId = session.resourceId;
    const threadId = session.threadId;
    await session.close();
    // After close, _liveSessions no longer contains the entry. The write
    // path falls back to the harness emitter.
    await harness.artifacts.write({
      sessionId,
      resourceId,
      threadId,
      artifactId: 'after-close',
      artifactType: 'report',
      attachmentId: attachment.attachmentId,
    });
    const created = events.find(e => e.type === 'artifact_created' && e.sessionId === sessionId) as any;
    expect(created).toBeDefined();
    expect(created.artifactId).toBe('after-close');
  });

  it('hard-delete cleans up artifact rows alongside attachment bytes', async () => {
    // Codex pass #1 caught that session deletion would leak artifact
    // rows pointing at deleted attachment bytes. Pin the cleanup
    // contract: after deleteSession, the artifact row is gone.
    const { harness, session, storage, attachment } = await setup();
    await harness.artifacts.write({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      artifactId: 'leak-check',
      artifactType: 'diff',
      attachmentId: attachment.attachmentId,
    });
    await session.close();
    await harness.deleteSession({ sessionId: session.id, resourceId: session.resourceId });
    await expect(
      storage.loadArtifact({
        sessionId: session.id,
        resourceId: session.resourceId,
        artifactId: 'leak-check',
      }),
    ).resolves.toBeNull();
  });
});

describe('harness.artifacts — capability-unsupported adapter', () => {
  async function setupNoArtifacts() {
    class NoArtifactsHarness extends InMemoryHarness {
      override writeArtifact = HarnessStorage.prototype.writeArtifact;
      override loadArtifact = HarnessStorage.prototype.loadArtifact;
      override listArtifacts = HarnessStorage.prototype.listArtifacts;
      override listArtifactVersions = HarnessStorage.prototype.listArtifactVersions;
    }
    const agent = new FakeAgent('default');
    const storage = new NoArtifactsHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    return { harness, session };
  }

  it('all four public surfaces throw HarnessArtifactsUnsupportedError', async () => {
    const { harness, session } = await setupNoArtifacts();
    const ctx = { sessionId: session.id, resourceId: session.resourceId };
    await expect(
      harness.artifacts.write({
        ...ctx,
        threadId: session.threadId,
        artifactId: 'a',
        artifactType: 'diff',
        attachmentId: 'x',
      }),
    ).rejects.toMatchObject({ name: 'HarnessArtifactsUnsupportedError' });
    await expect(harness.artifacts.get({ ...ctx, artifactId: 'a' })).rejects.toMatchObject({
      name: 'HarnessArtifactsUnsupportedError',
    });
    await expect(harness.artifacts.list({ ...ctx })).rejects.toMatchObject({
      name: 'HarnessArtifactsUnsupportedError',
    });
    await expect(harness.artifacts.versions({ ...ctx, artifactId: 'a' })).rejects.toMatchObject({
      name: 'HarnessArtifactsUnsupportedError',
    });
  });
});
