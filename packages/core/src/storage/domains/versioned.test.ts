import { describe, expect, it, vi } from 'vitest';
import { VersionedStorageDomain } from './versioned';
import type {
  CreateVersionInputBase,
  ListVersionsInputBase,
  ListVersionsOutputBase,
  VersionBase,
  VersionedEntityBase,
} from './versioned';

type Snapshot = { instructions: string };
type Version = VersionBase & Snapshot & { ownerId: string };
type ResolvedEntity = VersionedEntityBase & Snapshot;
type ListVersionsInput = ListVersionsInputBase & { entityId: string };

/** A pre-label custom domain implementing only the original abstract contract. */
export class LegacyVersionedStorage extends VersionedStorageDomain<
  VersionedEntityBase,
  Snapshot,
  ResolvedEntity,
  Version,
  CreateVersionInputBase & Snapshot & { ownerId: string },
  ListVersionsInput,
  ListVersionsOutputBase<Version>,
  VersionedEntityBase,
  VersionedEntityBase,
  undefined,
  { entities: VersionedEntityBase[] },
  { entities: ResolvedEntity[] }
> {
  protected readonly listKey = 'entities';
  protected readonly versionMetadataFields = ['id', 'ownerId', 'versionNumber', 'createdAt'];

  getById = vi.fn<(id: string) => Promise<VersionedEntityBase | null>>();
  create = vi.fn<(input: VersionedEntityBase) => Promise<VersionedEntityBase>>();
  update = vi.fn<(input: VersionedEntityBase) => Promise<VersionedEntityBase>>();
  delete = vi.fn<(id: string) => Promise<void>>();
  list = vi.fn<() => Promise<{ entities: VersionedEntityBase[] }>>();
  createVersion = vi.fn<(input: CreateVersionInputBase & Snapshot & { ownerId: string }) => Promise<Version>>();
  getVersion = vi.fn<(id: string) => Promise<Version | null>>();
  getVersionByNumber = vi.fn<(entityId: string, versionNumber: number) => Promise<Version | null>>();
  getLatestVersion = vi.fn<(entityId: string) => Promise<Version | null>>();
  listVersions = vi.fn<(input: ListVersionsInput) => Promise<ListVersionsOutputBase<Version>>>();
  deleteVersion = vi.fn<(id: string) => Promise<void>>();
  deleteVersionsByParentId = vi.fn<(entityId: string) => Promise<void>>();
  countVersions = vi.fn<(entityId: string) => Promise<number>>();
  dangerouslyClearAll = vi.fn<() => Promise<void>>();

  constructor() {
    super({ component: 'STORAGE', name: 'LEGACY_VERSIONED_STORAGE' });
  }
}

class MappedVersionedStorage extends LegacyVersionedStorage {
  protected override readonly versionParentIdField = 'ownerId';
}

class LabelVersionedStorage extends LegacyVersionedStorage {
  protected override readonly versionLabelEntityType = 'agent' as const;
}

const ownedVersion: Version = {
  id: 'version-1',
  ownerId: 'entity-1',
  versionNumber: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  instructions: 'Owned configuration',
};

function setup<T extends LegacyVersionedStorage>(storage: T): T {
  storage.getById.mockResolvedValue({ id: 'entity-1', activeVersionId: ownedVersion.id });
  storage.getVersion.mockResolvedValue(ownedVersion);
  storage.getVersionByNumber.mockResolvedValue(ownedVersion);
  storage.getLatestVersion.mockResolvedValue(ownedVersion);
  return storage;
}

describe('VersionedStorageDomain ownership compatibility', () => {
  it('resolves exact versions for an existing custom domain without requiring an ownership field', async () => {
    const storage = setup(new LegacyVersionedStorage());

    await expect(storage.getByIdResolved('entity-1', { versionId: ownedVersion.id })).resolves.toEqual({
      id: 'entity-1',
      activeVersionId: ownedVersion.id,
      instructions: ownedVersion.instructions,
      resolvedVersionId: ownedVersion.id,
    });
    expect(storage.getVersionByNumber).toHaveBeenCalledWith('entity-1', ownedVersion.versionNumber);
  });

  it.each([null, { ...ownedVersion, id: 'different-version' }])(
    'rejects a custom-domain version when its scoped lookup does not confirm the same immutable version (%j)',
    async scopedVersion => {
      const storage = setup(new LegacyVersionedStorage());
      storage.getVersion.mockResolvedValue({ ...ownedVersion, ownerId: 'another-entity' });
      storage.getVersionByNumber.mockResolvedValue(scopedVersion);

      await expect(storage.getByIdResolved('entity-1', { versionId: ownedVersion.id })).rejects.toMatchObject({
        id: 'VERSION_NOT_OWNED_BY_ENTITY',
      });
    },
  );

  it('does not trust a globally fetched row with a different immutable ID', async () => {
    const storage = setup(new LegacyVersionedStorage());
    storage.getVersion.mockResolvedValue({ ...ownedVersion, id: 'different-version' });

    await expect(storage.getByIdResolved('entity-1', { versionId: ownedVersion.id })).rejects.toMatchObject({
      id: 'VERSION_NOT_OWNED_BY_ENTITY',
    });
  });

  it('leaves legacy status resolution unchanged without adding a scoped read', async () => {
    const storage = setup(new LegacyVersionedStorage());

    await expect(storage.getByIdResolved('entity-1')).resolves.toMatchObject({ resolvedVersionId: ownedVersion.id });
    expect(storage.getVersionByNumber).not.toHaveBeenCalled();
  });

  it('verifies mapped domains directly without consulting a potentially lagging scoped reader', async () => {
    const storage = setup(new MappedVersionedStorage());
    storage.getVersionByNumber.mockResolvedValue(null);

    await expect(storage.getByIdResolved('entity-1', { versionId: ownedVersion.id })).resolves.toMatchObject({
      resolvedVersionId: ownedVersion.id,
    });
    expect(storage.getVersionByNumber).not.toHaveBeenCalled();
  });

  it('does not let a scoped lookup bypass a mapped ownership mismatch', async () => {
    const storage = setup(new MappedVersionedStorage());
    storage.getVersion.mockResolvedValue({ ...ownedVersion, ownerId: 'another-entity' });

    await expect(storage.getByIdResolved('entity-1', { versionId: ownedVersion.id })).rejects.toMatchObject({
      id: 'VERSION_NOT_OWNED_BY_ENTITY',
    });
    expect(storage.getVersionByNumber).not.toHaveBeenCalled();
  });

  it.each(['production', 'latest'])('verifies ownership for an opted-in custom domain resolving %s', async label => {
    const storage = setup(new LabelVersionedStorage());

    await expect(storage.getByIdResolved('entity-1', { label })).resolves.toMatchObject({
      resolvedVersionId: ownedVersion.id,
      selectedVersionLabel: label,
    });
    expect(storage.getVersionByNumber).toHaveBeenCalledWith('entity-1', ownedVersion.versionNumber);

    storage.getVersionByNumber.mockResolvedValue(null);
    await expect(storage.getByIdResolved('entity-1', { label })).rejects.toMatchObject({
      id: 'VERSION_LABEL_INTEGRITY_ERROR',
    });
  });

  it('does not opt an existing custom domain into labels', async () => {
    const storage = setup(new LegacyVersionedStorage());

    await expect(storage.getByIdResolved('entity-1', { label: 'latest' })).rejects.toMatchObject({
      id: 'VERSION_LABELS_UNSUPPORTED',
    });
    expect(storage.getVersionByNumber).not.toHaveBeenCalled();
  });
});
