import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FilesystemDB } from '../../filesystem-db';
import { FilesystemAgentsStorage } from './filesystem';

describe('FilesystemAgentsStorage', () => {
  let storageDir: string | undefined;

  afterEach(() => {
    if (storageDir) {
      rmSync(storageDir, { recursive: true, force: true });
      storageDir = undefined;
    }
  });

  it('stores unknown agents in the shared agents file', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    storage.__registerMastra({
      getAgentById: () => {
        throw new Error('Agent with id stored-agent not found');
      },
    } as any);

    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Help users.',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const version = await storage.getLatestVersion('stored-agent');

    await storage.update({ id: 'stored-agent', status: 'published', activeVersionId: version?.id });

    const agentsFile = JSON.parse(readFileSync(join(storageDir, 'agents.json'), 'utf-8'));
    expect(agentsFile['stored-agent']).toMatchObject({
      name: 'Stored Agent',
      instructions: 'Help users.',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
    });
    expect(existsSync(join(storageDir, 'agents', 'stored-agent.json'))).toBe(false);
  });

  it('rethrows unexpected code-agent lookup failures', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    storage.__registerMastra({
      getAgentById: () => {
        throw new Error('registry unavailable');
      },
    } as any);

    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Help users.',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const version = await storage.getLatestVersion('stored-agent');

    await expect(
      storage.update({ id: 'stored-agent', status: 'published', activeVersionId: version?.id }),
    ).rejects.toThrow('registry unavailable');
  });

  it('rejects custom-label access for registered code agents while advertising stored-agent support', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    storage.__registerMastra({
      getAgentById: id => (id === 'code-agent' ? { source: 'code' } : undefined),
    });

    await storage.init();
    expect(storage.storageCapabilities.versionLabels.entityTypes.agent).toEqual(storage.versionLabels.capabilities);

    const getCustomLabel = () =>
      storage.versionLabels.get({ entityType: 'agent', entityId: 'code-agent', label: 'staging' });
    await expect(getCustomLabel()).rejects.toMatchObject({
      id: 'VERSION_LABELS_UNSUPPORTED',
      details: { entityType: 'agent', entityId: 'code-agent' },
    });
    await expect(getCustomLabel()).rejects.toMatchObject({
      id: 'VERSION_LABELS_UNSUPPORTED',
      details: { entityType: 'agent', entityId: 'code-agent' },
    });
  });

  it('persists custom labels and their exact draft versions across instances', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Version one',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const versionOne = await storage.getLatestVersion('stored-agent');
    expect(versionOne).not.toBeNull();
    const versionTwo = await storage.createVersion({
      id: 'stored-agent-v2',
      agentId: 'stored-agent',
      versionNumber: 2,
      name: 'Stored Agent',
      instructions: 'Version two',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      changedFields: ['instructions'],
    });
    const createdPointer = await storage.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: versionTwo.id,
      expectedRevisionToken: null,
    });

    const restarted = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await restarted.init();

    const persistedPointer = await restarted.versionLabels.get({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
    });
    expect(persistedPointer).toEqual(createdPointer);
    await expect(restarted.getVersion(versionOne!.id)).resolves.toMatchObject({ id: versionOne!.id });
    await expect(restarted.getByIdResolved('stored-agent', { label: 'staging' })).resolves.toMatchObject({
      id: 'stored-agent',
      instructions: 'Version two',
      resolvedVersionId: versionTwo.id,
      selectedVersionLabel: 'staging',
    });

    const movedPointer = await restarted.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: versionOne!.id,
      expectedRevisionToken: persistedPointer!.revisionToken,
    });
    expect(movedPointer.revisionToken).not.toBe(createdPointer.revisionToken);

    // An invalid production pointer is existing representable state. Preserve
    // the custom label across restart and let strict production resolution
    // report the integrity error instead of corrupting the whole registry.
    await restarted.update({ id: 'stored-agent', status: 'published', activeVersionId: 'missing-active-version' });
    const restartedAgain = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await restartedAgain.init();
    await expect(restartedAgain.getByIdResolved('stored-agent', { label: 'staging' })).resolves.toMatchObject({
      resolvedVersionId: versionOne!.id,
    });
    await expect(restartedAgain.getByIdResolved('stored-agent', { label: 'production' })).rejects.toMatchObject({
      id: 'VERSION_LABEL_INTEGRITY_ERROR',
    });
  });

  it('keeps retained registry state fresh for version writes on a labeled agent across restart', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Version one',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const versionOne = await storage.getLatestVersion('stored-agent');
    await storage.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: versionOne!.id,
      expectedRevisionToken: null,
    });

    // Writes AFTER labeling must land in the retained registry copy, or a
    // restart would revert the agent to the state captured at label time.
    const versionTwo = await storage.createVersion({
      id: 'stored-agent-v2',
      agentId: 'stored-agent',
      versionNumber: 2,
      name: 'Stored Agent',
      instructions: 'Version two',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      changedFields: ['instructions'],
    });
    const versionThree = await storage.createVersion({
      id: 'stored-agent-v3',
      agentId: 'stored-agent',
      versionNumber: 3,
      name: 'Stored Agent',
      instructions: 'Version three',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      changedFields: ['instructions'],
    });
    await storage.deleteVersion(versionTwo.id);

    const restarted = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await restarted.init();

    await expect(restarted.getVersion(versionThree.id)).resolves.toMatchObject({
      id: versionThree.id,
      instructions: 'Version three',
    });
    await expect(restarted.getVersion(versionTwo.id)).resolves.toBeNull();
    await expect(restarted.getByIdResolved('stored-agent', { label: 'latest' })).resolves.toMatchObject({
      resolvedVersionId: versionThree.id,
    });
    await expect(restarted.getByIdResolved('stored-agent', { label: 'staging' })).resolves.toMatchObject({
      resolvedVersionId: versionOne!.id,
      instructions: 'Version one',
    });
  });

  it('serializes cross-instance CAS and invalidates deleted retained targets', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const first = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    const second = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await first.init();
    await second.init();

    await first.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Version one',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const versionOne = await first.getLatestVersion('stored-agent');
    const versionTwo = await first.createVersion({
      id: 'stored-agent-v2',
      agentId: 'stored-agent',
      versionNumber: 2,
      name: 'Stored Agent',
      instructions: 'Version two',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      changedFields: ['instructions'],
    });
    const pointer = await first.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: versionOne!.id,
      expectedRevisionToken: null,
    });

    await expect(
      second.versionLabels.set({
        entityType: 'agent',
        entityId: 'stored-agent',
        label: 'staging',
        versionId: versionTwo.id,
        expectedRevisionToken: null,
      }),
    ).rejects.toMatchObject({ id: 'VERSION_LABEL_CONFLICT' });
    await expect(
      second.versionLabels.get({ entityType: 'agent', entityId: 'stored-agent', label: 'staging' }),
    ).resolves.toEqual(pointer);

    await first.delete('stored-agent');
    await expect(
      second.versionLabels.set({
        entityType: 'agent',
        entityId: 'stored-agent',
        label: 'replacement',
        versionId: versionOne!.id,
        expectedRevisionToken: null,
      }),
    ).rejects.toMatchObject({ id: 'ENTITY_NOT_FOUND' });
    await expect(second.getById('stored-agent')).resolves.toBeNull();
    await expect(second.getVersion(versionOne!.id)).resolves.toBeNull();
  });

  it('falls back to the published snapshot when another instance releases the last label', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const first = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    const second = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await first.init();
    await second.init();

    await first.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Published version',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const version = await first.getLatestVersion('stored-agent');
    await first.update({ id: 'stored-agent', status: 'published', activeVersionId: version!.id });
    const pointer = await first.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: version!.id,
      expectedRevisionToken: null,
    });
    await expect(
      second.versionLabels.get({ entityType: 'agent', entityId: 'stored-agent', label: 'staging' }),
    ).resolves.toEqual(pointer);

    await first.versionLabels.delete({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      expectedRevisionToken: pointer.revisionToken,
    });
    await expect(
      second.versionLabels.get({ entityType: 'agent', entityId: 'stored-agent', label: 'staging' }),
    ).resolves.toBeNull();
    await expect(second.getById('stored-agent')).resolves.toMatchObject({
      status: 'published',
      activeVersionId: 'hydrated-stored-agent-v1',
    });
    await expect(second.getLatestVersion('stored-agent')).resolves.toMatchObject({
      id: 'hydrated-stored-agent-v1',
      instructions: 'Published version',
    });
  });

  it('rolls back retained memory when a registry replacement fails', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const db = new FilesystemDB(storageDir);
    const storage = new FilesystemAgentsStorage({ db });
    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Version one',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const versionOne = await storage.getLatestVersion('stored-agent');
    const pointer = await storage.versionLabels.set({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      versionId: versionOne!.id,
      expectedRevisionToken: null,
    });

    const writeSpy = vi.spyOn(db, 'writeJsonFile');
    writeSpy.mockImplementationOnce(() => {
      throw new Error('registry write failed');
    });
    await expect(
      storage.createVersion({
        id: 'rejected-version',
        agentId: 'stored-agent',
        versionNumber: 2,
        name: 'Stored Agent',
        instructions: 'Rejected version',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
        changedFields: ['instructions'],
      }),
    ).rejects.toThrow('registry write failed');
    await expect(storage.getVersion('rejected-version')).resolves.toBeNull();

    writeSpy.mockImplementationOnce(() => {
      throw new Error('registry write failed');
    });
    await expect(
      storage.update({ id: 'stored-agent', status: 'published', activeVersionId: versionOne!.id }),
    ).rejects.toThrow('registry write failed');
    const rolledBackAgent = await storage.getById('stored-agent');
    expect(rolledBackAgent).toMatchObject({ status: 'draft' });
    expect(rolledBackAgent).not.toHaveProperty('activeVersionId');
    writeSpy.mockRestore();

    const restarted = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await restarted.init();
    await expect(restarted.getById('stored-agent')).resolves.toMatchObject({ status: 'draft' });
    await expect(restarted.getVersion('rejected-version')).resolves.toBeNull();
    await restarted.versionLabels.delete({
      entityType: 'agent',
      entityId: 'stored-agent',
      label: 'staging',
      expectedRevisionToken: pointer.revisionToken,
    });

    const afterRelease = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await afterRelease.init();
    await expect(afterRelease.getById('stored-agent')).resolves.toBeNull();
  });

  it('fails closed when the durable label registry is corrupt', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    writeFileSync(join(storageDir, 'agent-version-labels.json'), '{invalid', 'utf-8');

    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    await expect(storage.init()).rejects.toMatchObject({ id: 'VERSION_LABEL_INTEGRITY_ERROR' });
    await expect(storage.init()).rejects.toMatchObject({ id: 'VERSION_LABEL_INTEGRITY_ERROR' });
    await expect(
      storage.versionLabels.list({ entityType: 'agent', entityId: 'stored-agent', perPage: false }),
    ).rejects.toMatchObject({ id: 'VERSION_LABEL_INTEGRITY_ERROR' });
  });
});
