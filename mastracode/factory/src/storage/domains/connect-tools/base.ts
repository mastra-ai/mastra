import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema } from '@mastra/core/storage';

export const CONNECT_TOOL_ORG_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'connect_tool_org_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    enabled_providers: { type: 'json' },
    updated_by: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'connect_tool_org_settings_org_unique', columns: ['org_id'] }],
};

interface ConnectToolSettingsRow extends Record<string, unknown> {
  enabled_providers: unknown;
}

function providerList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export class ConnectToolSettingsStorage extends FactoryStorageDomain {
  constructor() {
    super('connect-tools');
  }

  async init(): Promise<void> {
    await this.ensureCollections([CONNECT_TOOL_ORG_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('connect_tool_org_settings', {});
  }

  async get({ orgId }: { orgId: string }): Promise<string[]> {
    const row = await this.ops.findOne<ConnectToolSettingsRow>('connect_tool_org_settings', { org_id: orgId });
    return providerList(row?.enabled_providers);
  }

  async save({
    orgId,
    enabledProviders,
    updatedBy,
  }: {
    orgId: string;
    enabledProviders: string[];
    updatedBy: string | null;
  }): Promise<void> {
    const where = { org_id: orgId };
    const values = () => ({ enabled_providers: enabledProviders, updated_by: updatedBy, updated_at: new Date() });
    if ((await this.ops.updateMany('connect_tool_org_settings', where, values())) > 0) return;
    const now = new Date();
    try {
      await this.ops.insertOne('connect_tool_org_settings', { ...where, ...values(), created_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.ops.updateMany('connect_tool_org_settings', where, values());
    }
  }
}
