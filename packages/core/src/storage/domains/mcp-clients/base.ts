import type {
  StorageMCPClientType,
  StorageMCPClientSnapshotType,
  StorageResolvedMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageListMCPClientsResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// MCP Client Version Types
// ============================================================================

/**
 * Represents a stored version of an MCP client's content.
 * Client fields are top-level on the version row (no nested snapshot object).
 */
export interface MCPClientVersion extends StorageMCPClientSnapshotType, VersionBase {
  /** ID of the MCP client this version belongs to */
  mcpClientId: string;
}

/**
 * Input for creating a new MCP client version.
 * Client fields are top-level (no nested snapshot object).
 */
export interface CreateMCPClientVersionInput extends StorageMCPClientSnapshotType, CreateVersionInputBase {
  /** ID of the MCP client this version belongs to */
  mcpClientId: string;
}

/**
 * Sort direction for version listings.
 */
export type MCPClientVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type MCPClientVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing MCP client versions with pagination and sorting.
 */
export interface ListMCPClientVersionsInput extends ListVersionsInputBase {
  /** ID of the MCP client to list versions for */
  mcpClientId: string;
}

/**
 * Output for listing MCP client versions with pagination info.
 */
export interface ListMCPClientVersionsOutput extends ListVersionsOutputBase<MCPClientVersion> {}

// ============================================================================
// MCPClientsStorage Base Class
// ============================================================================

export abstract class MCPClientsStorage extends VersionedStorageDomain<
  StorageMCPClientType,
  StorageMCPClientSnapshotType,
  StorageResolvedMCPClientType,
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
  { mcpClient: StorageCreateMCPClientInput },
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput | undefined,
  StorageListMCPClientsOutput,
  StorageListMCPClientsResolvedOutput
> {
  protected readonly listKey = 'mcpClients';
  protected readonly versionMetadataFields = [
    'id',
    'mcpClientId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof MCPClientVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'MCP_CLIENTS',
    });
  }
}
