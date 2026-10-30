import type {
  KnowledgeImporterConnectionStatus,
  KnowledgeImporterOptionValue,
  KnowledgeImporterSettings,
  SaveKnowledgeImporterSettingsParams,
} from '@mastra/client-js';

/** Select value for `connectionId: null` — the server picks the single linked connection. */
export const AUTOMATIC_CONNECTION = 'automatic';

/** The editable form. Wire `null`s become `''`/`AUTOMATIC_CONNECTION` here and go back at the boundary. */
export interface ImporterDraft {
  enabled: boolean;
  /** `''` keeps the env/default schedule. */
  schedule: string;
  connectionId: string;
  options: Record<string, KnowledgeImporterOptionValue>;
}

export function draftFromSettings(settings: KnowledgeImporterSettings): ImporterDraft {
  return {
    enabled: settings.enabled,
    schedule: settings.schedule ?? '',
    connectionId: settings.connectionId ?? AUTOMATIC_CONNECTION,
    options: settings.options,
  };
}

export function draftToSettings(draft: ImporterDraft): Omit<SaveKnowledgeImporterSettingsParams, 'expectedVersion'> {
  const schedule = draft.schedule.trim();
  return {
    enabled: draft.enabled,
    schedule: schedule === '' ? null : schedule,
    connectionId: draft.connectionId === AUTOMATIC_CONNECTION ? null : draft.connectionId,
    options: draft.options,
  };
}

export function isDraftDirty(draft: ImporterDraft, settings: KnowledgeImporterSettings): boolean {
  return JSON.stringify(draftToSettings(draft)) !== JSON.stringify(draftToSettings(draftFromSettings(settings)));
}

/** Lists are allowlists: an empty one imports nothing, never everything. */
/** Contract: disabling or narrowing never purges what was imported. */
export const STOPS_NEW_IMPORTS_NOTE = 'Stops new imports. Knowledge already imported stays.';

export const READ_ONLY_NOTE = 'Read-only: ask an org admin';

/** The server answers writes from read-only callers with `403 { error: { code: 'forbidden' } }`. */
export const isForbiddenError = (error: unknown) => {
  const { status, code } = readApiError(error);
  return code === 'forbidden' || status === 403;
};

export function describeAllowlist(values: readonly string[], label: string): string {
  if (values.length === 0) return `Imports nothing until you add ${label.toLowerCase()}.`;
  return values.length === 1 ? 'Imports only this one.' : `Imports only these ${values.length}.`;
}

export type ConnectionGate =
  /** No connection linked to this project: no run, dry-run or enable controls at all. */
  { kind: 'hidden' } | { kind: 'disabled'; reason: string } | { kind: 'enabled' };

export function connectionGate(
  connection: { status: KnowledgeImporterConnectionStatus; message?: string },
  draftConnectionId: string,
): ConnectionGate {
  switch (connection.status) {
    case 'none':
      return { kind: 'hidden' };
    case 'needs_reauth':
      return { kind: 'disabled', reason: connection.message ?? 'The connection needs to be re-authorized.' };
    case 'error':
      return { kind: 'disabled', reason: connection.message ?? 'The connection is failing.' };
    case 'ambiguous':
      return draftConnectionId === AUTOMATIC_CONNECTION
        ? { kind: 'disabled', reason: 'Several connections are linked — choose one first.' }
        : { kind: 'enabled' };
    case 'ok':
      return { kind: 'enabled' };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Reads the contract's `{ error: { code, message } }` body off a client error. */
export function readApiError(error: unknown): { status?: number; code?: string; message: string } {
  if (!isRecord(error)) return { message: 'Request failed' };
  const status = typeof error.status === 'number' ? error.status : undefined;
  const body = isRecord(error.body) && isRecord(error.body.error) ? error.body.error : undefined;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const fallback = typeof error.message === 'string' ? error.message : 'Request failed';
  const message = typeof body?.message === 'string' ? body.message : fallback;
  return { status, code, message };
}
