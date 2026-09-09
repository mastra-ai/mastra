/**
 * Browser-side helpers for the factory documents inventory.
 *
 * Talks to the server's `/web/factory/projects/:id/documents*` routes, whose
 * payloads are typed from `FACTORY_ROUTE_CONTRACTS` (see `src/api/types.ts`).
 * The inventory is the server's fixed catalog joined with whatever has been
 * synced from the repository: every catalog kind renders as a row, and a kind
 * the sync has not seen yet renders as `missing`.
 */

import type {
  FactoryDocument,
  FactoryDocumentCatalogEntry,
  FactoryDocumentDetailResponse,
  FactoryDocumentsRefreshResponse,
  FactoryDocumentsResponse,
} from '../../../../api/types';
import { requestJson } from './request';

export type FactoryDocumentGroup = FactoryDocumentCatalogEntry['group'];
export type FactoryDocumentStatus = FactoryDocument['status'];

/** One inventory row: the catalog definition plus the synced entry, when any. */
export interface FactoryDocumentInventoryRow {
  kind: string;
  group: FactoryDocumentGroup;
  label: string;
  purpose: string;
  /** The synced path, else the catalog default. */
  path: string;
  status: FactoryDocumentStatus;
  document: FactoryDocument | null;
}

export const DOCUMENT_GROUP_LABELS: Record<FactoryDocumentGroup, string> = {
  ba: 'Business documents',
  tech: 'Technical documents',
};

export const DOCUMENT_GROUPS: readonly FactoryDocumentGroup[] = ['ba', 'tech'];

export function fetchFactoryDocuments(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<FactoryDocumentsResponse> {
  return requestJson<FactoryDocumentsResponse>(`${baseUrl}/web/factory/projects/${factoryProjectId}/documents`, {
    signal,
  });
}

export function fetchFactoryDocument(
  baseUrl: string,
  factoryProjectId: string,
  kind: string,
  signal?: AbortSignal,
): Promise<FactoryDocumentDetailResponse> {
  return requestJson<FactoryDocumentDetailResponse>(
    `${baseUrl}/web/factory/projects/${factoryProjectId}/documents/${encodeURIComponent(kind)}`,
    { signal },
  );
}

export function refreshFactoryDocuments(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactoryDocumentsRefreshResponse> {
  return requestJson<FactoryDocumentsRefreshResponse>(
    `${baseUrl}/web/factory/projects/${factoryProjectId}/documents/refresh`,
    { method: 'POST' },
  );
}

/** Catalog order, one row per kind, synced entries joined in; missing rows synthesised. */
export function inventoryRows(response: FactoryDocumentsResponse): FactoryDocumentInventoryRow[] {
  const byKind = new Map(response.documents.map(document => [document.kind, document]));
  return response.catalog.map(definition => {
    const document = byKind.get(definition.kind) ?? null;
    return {
      kind: definition.kind,
      group: definition.group,
      label: definition.label,
      purpose: definition.purpose,
      path: document?.path ?? definition.defaultPath,
      status: document?.status ?? 'missing',
      document,
    };
  });
}

export function inventoryByGroup(
  response: FactoryDocumentsResponse,
): Record<FactoryDocumentGroup, FactoryDocumentInventoryRow[]> {
  const groups: Record<FactoryDocumentGroup, FactoryDocumentInventoryRow[]> = { ba: [], tech: [] };
  for (const row of inventoryRows(response)) groups[row.group].push(row);
  return groups;
}

export function countPresent(rows: FactoryDocumentInventoryRow[]): { present: number; total: number } {
  return { present: rows.filter(row => row.status !== 'missing').length, total: rows.length };
}
