import { externalSourceKey } from '../../storage/domains/work-items/base.js';
import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import type { WorkItemProvider } from '../../storage/domains/work-items/work-item-schema.js';
import { SHARED_PROVIDER_METADATA_KEYS, splitCardMetadata, stringList, stringValue } from './metadata-keys.js';
import type { ProviderWorkItemSource, WorkItemProviderAdapter } from './types.js';

export interface ExternalAdapterSpec {
  /** Take the provider from the source's integration id (chat adapters, custom integrations). */
  providerFromSource?: boolean;
  /** Keys this provider owns beyond {@link SHARED_PROVIDER_METADATA_KEYS}. */
  providerMetadataKeys: readonly string[];
  key(source: ExternalWorkItemSource, metadata: Record<string, unknown>): string | null;
  state?(source: ExternalWorkItemSource, metadata: Record<string, unknown>): string | null;
  author?(metadata: Record<string, unknown>): string | null;
}

/**
 * The id unique per project and provider. It is the legacy source key without
 * the integration id (which is the provider): source types and workspaces
 * scope it, because ids such as a GitLab iid or a Slack `ts` repeat across them.
 */
export function providerExternalId(source: ExternalWorkItemSource): string {
  const workspace = source.workspaceId ? `${source.workspaceId}:` : '';
  return `${source.type}:${workspace}${source.externalId}`;
}

export function mergedState(_source: ExternalWorkItemSource, metadata: Record<string, unknown>): string | null {
  return metadata.merged === true ? 'merged' : stringValue(metadata.state);
}

/** An adapter for a provider whose cards carry an {@link ExternalWorkItemSource}. */
export function externalAdapter(provider: WorkItemProvider, spec: ExternalAdapterSpec): WorkItemProviderAdapter {
  const providerMetadataKeys = [...SHARED_PROVIDER_METADATA_KEYS, ...spec.providerMetadataKeys];
  return {
    provider,
    providerMetadataKeys,
    toSource(source: ExternalWorkItemSource | null, metadata: Record<string, unknown> | null): ProviderWorkItemSource {
      if (!source) throw new Error(`A ${provider} work item needs an external source.`);
      const facts = metadata ?? {};
      return {
        provider: spec.providerFromSource ? source.integrationId : provider,
        integrationId: source.integrationId,
        sourceType: source.type,
        workspaceId: source.workspaceId ?? null,
        externalId: providerExternalId(source),
        sourceKey: externalSourceKey(source),
        url: source.url ?? null,
        key: spec.key(source, facts),
        state: spec.state ? spec.state(source, facts) : stringValue(facts.state),
        labels: stringList(facts.labels),
        author: spec.author ? spec.author(facts) : stringValue(facts.author),
        metadata: splitCardMetadata(metadata, providerMetadataKeys).provider,
      };
    },
  };
}
