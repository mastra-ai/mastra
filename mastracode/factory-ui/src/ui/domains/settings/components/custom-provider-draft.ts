import type { CustomProviderHeaderBody, CustomProviderInfo } from '../../../../api/types';

export type CustomProviderAuthScheme = CustomProviderInfo['authScheme'];

/** The server refuses more custom headers than this. */
export const MAX_CUSTOM_HEADERS = 20;

/** One row of the custom headers editor. */
export interface HeaderDraft {
  /** Stable React key: the name changes as the user types it. */
  key: string;
  name: string;
  value: string;
  secret: boolean;
  /**
   * The name of the saved secret header this row came from. The server never returns its value, so while the
   * row keeps that name, stays secret and has an empty value, the saved value is kept.
   */
  savedSecretName?: string;
}

/** What the custom provider form holds before it is sent. */
export interface CustomProviderDraft {
  name: string;
  url: string;
  apiKey: string;
  authScheme: CustomProviderAuthScheme;
  headers: HeaderDraft[];
  models: string[];
}

let headerKeySeed = 0;

/** A key for a header row, unique for the page's lifetime. */
function nextHeaderKey(): string {
  headerKeySeed += 1;
  return `header-${headerKeySeed}`;
}

/** An empty header row. New headers start secret, as the server treats a header sent without a flag. */
export function newHeaderDraft(): HeaderDraft {
  return { key: nextHeaderKey(), name: '', value: '', secret: true };
}

/** The form's starting state: the saved provider's settings, or an empty draft. A saved secret value is never known. */
export function initialCustomProviderDraft(provider: CustomProviderInfo | undefined): CustomProviderDraft {
  return {
    name: provider?.name ?? '',
    url: provider?.url ?? '',
    apiKey: '',
    authScheme: provider?.authScheme ?? 'bearer',
    headers: (provider?.headers ?? []).map(header => ({
      key: nextHeaderKey(),
      name: header.name,
      value: header.secret ? '' : (header.value ?? ''),
      secret: header.secret,
      ...(header.secret ? { savedSecretName: header.name } : {}),
    })),
    models: provider?.models ?? [],
  };
}

/** Whether the row still names its saved secret header, ignoring case like HTTP does. */
function namesSavedSecret(header: HeaderDraft): boolean {
  return (
    header.savedSecretName !== undefined && header.name.trim().toLowerCase() === header.savedSecretName.toLowerCase()
  );
}

/** Whether the row has a saved secret value behind it, which an empty value keeps. */
export function hasSavedSecret(header: HeaderDraft): boolean {
  return header.secret && namesSavedSecret(header);
}

/** Whether an empty value on this row keeps the saved secret value instead of needing a new one. */
function keepsSavedSecret(header: HeaderDraft): boolean {
  return hasSavedSecret(header) && !header.value.trim();
}

/** A row with no name, no value and no saved value behind it is dropped instead of refused. */
function isBlankHeader(header: HeaderDraft): boolean {
  return !header.name.trim() && !header.value.trim();
}

/**
 * Why the headers cannot be sent yet, checked before the server would refuse them. Name syntax, reserved names
 * and duplicates are left to the server, which owns those rules.
 */
export function headerDraftProblem(headers: HeaderDraft[]): string | undefined {
  for (const [index, header] of headers.entries()) {
    if (isBlankHeader(header)) continue;
    const name = header.name.trim();
    if (!name) return `Enter a name for header ${index + 1}.`;
    if (header.value.trim() || keepsSavedSecret(header)) continue;
    // The server keeps a saved secret value only while the header stays secret.
    if (namesSavedSecret(header)) return `Enter a value for ${name} to make it plain.`;
    return `Enter a value for ${name}.`;
  }
  return undefined;
}

/**
 * The headers as the server reads them: the full list, each with an explicit flag. A kept secret is sent by
 * name only, because the server refuses an empty value.
 */
export function headerBodies(headers: HeaderDraft[]): CustomProviderHeaderBody[] {
  return headers
    .filter(header => !isBlankHeader(header))
    .map(header => {
      const value = header.value.trim();
      return { name: header.name.trim(), secret: header.secret, ...(value ? { value } : {}) };
    });
}

/** The connection settings a test and a save send, from the draft. */
export function connectionFields(draft: CustomProviderDraft) {
  const apiKey = draft.apiKey.trim();
  return {
    url: draft.url.trim(),
    ...(apiKey ? { apiKey } : {}),
    authScheme: draft.authScheme,
    headers: headerBodies(draft.headers),
  };
}

/** Changes whenever a connection test would call the endpoint differently, so an older result can be marked out of date. */
export function connectionSignature(draft: CustomProviderDraft): string {
  return JSON.stringify(connectionFields(draft));
}
