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

/** A header input, so a problem can move focus to the control it is about. */
export interface HeaderInputTarget {
  key: string;
  input: 'name' | 'value';
}

/** A header problem: what to tell the user, and the input it is about when one can be named. */
export interface HeaderProblem {
  message: string;
  target?: HeaderInputTarget;
}

/** The DOM id of a header row's input, shared by the editor that renders it and the form that focuses it. */
export function headerInputId({ key, input }: HeaderInputTarget): string {
  return `custom-provider-${key}-${input}`;
}

/**
 * Why the headers cannot be sent yet, checked before the server would refuse them. Name syntax, reserved names
 * and duplicates are left to the server, which owns those rules.
 */
export function headerDraftProblem(headers: HeaderDraft[]): HeaderProblem | undefined {
  for (const [index, header] of headers.entries()) {
    if (isBlankHeader(header)) continue;
    const name = header.name.trim();
    if (!name) return { message: `Enter a name for header ${index + 1}.`, target: { key: header.key, input: 'name' } };
    if (header.value.trim() || keepsSavedSecret(header)) continue;
    const target: HeaderInputTarget = { key: header.key, input: 'value' };
    // The server keeps a saved secret value only while the header stays secret.
    if (namesSavedSecret(header)) return { message: `Enter a value for ${name} to make it plain.`, target };
    return { message: `Enter a value for ${name}.`, target };
  }
  return undefined;
}

/**
 * The input a header refusal from the server is about, when the draft lets it be told. A missing value can only
 * be a row sent without one, which is a kept secret value; a refused header is the row its message names.
 */
export function serverHeaderProblemTarget(
  code: 'header_refused' | 'header_value_required',
  message: string,
  headers: HeaderDraft[],
): HeaderInputTarget | undefined {
  if (code === 'header_value_required') {
    const unsent = headers.find(header => header.name.trim() && !header.value.trim());
    return unsent && { key: unsent.key, input: 'value' };
  }
  const lowered = message.toLowerCase();
  // The longest name wins, so a message about `X-Org-Id` points at that row even when an `X-Org` row exists.
  const named = headers
    .filter(header => header.name.trim() && mentionsToken(lowered, header.name.trim().toLowerCase()))
    .toSorted((left, right) => right.name.trim().length - left.name.trim().length)[0];
  return named && { key: named.key, input: 'name' };
}

/** The characters an HTTP header name is made of (RFC 9110 `tchar`). */
const HEADER_NAME_CHAR = /[A-Za-z0-9!#$%&'*+.^_`|~-]/;

/** Whether the character next to a match would make it part of a longer name or word. */
function extendsToken(char: string | undefined): boolean {
  return char !== undefined && HEADER_NAME_CHAR.test(char);
}

/**
 * Whether `name` appears in `text` as a whole header name, not inside a word or a longer name. Both are
 * lowercased by the caller, since header names compare ignoring case.
 */
function mentionsToken(text: string, name: string): boolean {
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    const before = text[at - 1];
    const after = text[at + name.length];
    // A sentence may end right after the name, so a trailing period followed by a space or the end still counts.
    const endsSentence = after === '.' && !extendsToken(text[at + name.length + 1]);
    if (!extendsToken(before) && (!extendsToken(after) || endsSentence)) return true;
  }
  return false;
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
