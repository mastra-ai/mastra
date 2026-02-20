import type {
  StorageMCPServerType,
  StorageMCPServerSnapshotType,
  StorageResolvedMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  StorageListMCPServersResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// MCP Server Version Types
// ============================================================================

/**
 * Represents a stored version of an MCP server's content.
 * Server fields are top-level on the version row (no nested snapshot object).
 */
export interface MCPServerVersion extends StorageMCPServerSnapshotType, VersionBase {
  /** ID of the MCP server this version belongs to */
  mcpServerId: string;
}

/**
 * Input for creating a new MCP server version.
 * Server fields are top-level (no nested snapshot object).
 */
export interface CreateMCPServerVersionInput extends StorageMCPServerSnapshotType, CreateVersionInputBase {
  /** ID of the MCP server this version belongs to */
  mcpServerId: string;
}

/**
 * Sort direction for version listings.
 */
export type MCPServerVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type MCPServerVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing MCP server versions with pagination and sorting.
 */
export interface ListMCPServerVersionsInput extends ListVersionsInputBase {
  /** ID of the MCP server to list versions for */
  mcpServerId: string;
}

/**
 * Output for listing MCP server versions with pagination info.
 */
export interface ListMCPServerVersionsOutput extends ListVersionsOutputBase<MCPServerVersion> {}

// ============================================================================
// MCPServersStorage Base Class
// ============================================================================

export abstract class MCPServersStorage extends VersionedStorageDomain<
  StorageMCPServerType,
  StorageMCPServerSnapshotType,
  StorageResolvedMCPServerType,
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
  { mcpServer: StorageCreateMCPServerInput },
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput | undefined,
  StorageListMCPServersOutput,
  StorageListMCPServersResolvedOutput
> {
  protected readonly listKey = 'mcpServers';
  protected readonly versionMetadataFields = [
    'id',
    'mcpServerId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof MCPServerVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'MCP_SERVERS',
    });
  }
}
