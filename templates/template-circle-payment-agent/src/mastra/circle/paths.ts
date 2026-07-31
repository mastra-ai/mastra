// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

// URL path-parameter binding. A payload field belonging in the path must be substituted into it:
// left on the query string it is ignored, and x402 charges before the server answers, so
// `/coins/{id}?id=bitcoin` is a paid 404. Placeholders arrive explicit (`{id}`, `[id]`, `:id`) or
// bare, where the publisher stripped the delimiters and left `/flights/id` looking literal; bare
// ones are recovered from `x-matched-path`. Fails open: with no template, the URL is left alone.

const TEMPLATE_PROBE_TIMEOUT_MS = 8_000;

const EXPLICIT_SEGMENT = /^(?:\{(.+)\}|\[(.+)\]|<(.+)>|:(.+))$/;

export interface PathPlaceholder {
  name: string;
  index: number;
}

export interface BoundUrl {
  url: string;
  // Placeholders still carrying their template value; calling would 4xx.
  unfilled: PathPlaceholder[];
  boundKeys: string[];
  boundQueryKeys: string[];
}

function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(s => s.length > 0);
}

function explicitName(segment: string): string | null {
  const m = EXPLICIT_SEGMENT.exec(decodeURIComponent(segment));
  if (!m) return null;
  const name = m[1] ?? m[2] ?? m[3] ?? m[4];
  return name && !name.includes('/') ? name : null;
}

// Placeholders the URL declares outright. A surviving delimiter is never a real value.
export function explicitPlaceholders(pathname: string): PathPlaceholder[] {
  const out: PathPlaceholder[] = [];
  segmentsOf(pathname).forEach((segment, index) => {
    const name = explicitName(segment);
    if (name) out.push({ name, index });
  });
  return out;
}

const templateCache = new Map<string, Promise<string | null>>();

// Ask the origin which route a URL matched. Unpaid: a paid route answers 402 and charges nothing.
async function probeMatchedPath(url: string, method: string): Promise<string | null> {
  const key = `${method} ${url}`;
  let pending = templateCache.get(key);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TEMPLATE_PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(url, { method, signal: controller.signal });
        return res.headers.get('x-matched-path');
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    templateCache.set(key, pending);
  }
  return pending;
}

// The names a call refers to its own inputs by, which a bare placeholder can masquerade as.
export function requestFieldNames(url: string, data: Record<string, unknown>): Set<string> {
  const names = new Set(Object.keys(data).map(k => k.toLowerCase()));
  try {
    for (const key of new URL(url).searchParams.keys()) names.add(key.toLowerCase());
  } catch {
    // An unparseable URL contributes no names; the payload's still count.
  }
  return names;
}

// Unfilled means delimited, the parameter's own name, or a field the call carries. Any other value
// was already substituted, so a bound URL is never re-bound.
export function placeholdersFromTemplate(
  pathname: string,
  template: string,
  fieldNames: Set<string> = new Set(),
): PathPlaceholder[] {
  const actual = segmentsOf(pathname);
  const declared = segmentsOf(template.split('?')[0] ?? '');
  if (declared.length !== actual.length) return [];
  const out: PathPlaceholder[] = [];
  declared.forEach((segment, index) => {
    const name = explicitName(segment);
    if (!name) return;
    const value = decodeURIComponent(actual[index] ?? '');
    const stillTemplate =
      value.toLowerCase() === name.toLowerCase() || fieldNames.has(value.toLowerCase()) || explicitName(value) !== null;
    if (stillTemplate) out.push({ name, index });
  });
  return out;
}

export async function findPathPlaceholders(
  url: string,
  method: string,
  data: Record<string, unknown> = {},
): Promise<PathPlaceholder[]> {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return [];
  }
  const explicit = explicitPlaceholders(pathname);
  if (explicit.length) return explicit;
  const template = await probeMatchedPath(url, method);
  return template ? placeholdersFromTemplate(pathname, template, requestFieldNames(url, data)) : [];
}

// Exact name match, then case-insensitive, then the sole leftover field. That last step binds a
// field the service names differently from its route parameter, so it is restricted to the
// unambiguous case and `declaredQuery` keeps a declared query field out of the path.
function pickField(
  placeholder: PathPlaceholder,
  remaining: Map<string, unknown>,
  soleRemainingPlaceholder: boolean,
  declaredQuery: Set<string> | null,
): string | null {
  if (remaining.has(placeholder.name)) return placeholder.name;
  const lower = placeholder.name.toLowerCase();
  for (const key of remaining.keys()) {
    if (key.toLowerCase() === lower) return key;
  }
  if (!soleRemainingPlaceholder) return null;
  const eligible = [...remaining.keys()].filter(k => !declaredQuery?.has(k));
  return eligible.length === 1 ? (eligible[0] ?? null) : null;
}

// Last-resort candidates: `/flights/id?ident=WN2417` holds the value the path is missing.
// Repeated keys are skipped, since an array is never one path segment.
function queryCandidates(u: URL): Map<string, unknown> {
  const counts = new Map<string, number>();
  for (const key of u.searchParams.keys()) counts.set(key, (counts.get(key) ?? 0) + 1);
  const out = new Map<string, unknown>();
  for (const [key, value] of u.searchParams) {
    if (counts.get(key) === 1) out.set(key, value);
  }
  return out;
}

function asSegment(value: unknown): string {
  const raw = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  return encodeURIComponent(raw);
}

// Encode a payload onto a URL: path parameters into their segments, the rest onto the query string,
// arrays as repeated keys. The payload wins over the query string, being the declared input.
export function bindUrl(
  url: string,
  data: Record<string, unknown>,
  placeholders: PathPlaceholder[],
  declaredQuery: Set<string> | null,
): BoundUrl {
  const u = new URL(url);
  const segments = segmentsOf(u.pathname);
  const remaining = new Map(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
  const fromQuery = queryCandidates(u);
  const boundKeys: string[] = [];
  const boundQueryKeys: string[] = [];
  const unfilled: PathPlaceholder[] = [];

  placeholders.forEach((placeholder, i) => {
    const sole = i === placeholders.length - 1;
    const key = pickField(placeholder, remaining, sole, declaredQuery);
    if (key !== null) {
      segments[placeholder.index] = asSegment(remaining.get(key));
      remaining.delete(key);
      boundKeys.push(key);
      return;
    }
    const queryKey = pickField(placeholder, fromQuery, sole, declaredQuery);
    if (queryKey !== null) {
      segments[placeholder.index] = asSegment(fromQuery.get(queryKey));
      fromQuery.delete(queryKey);
      // Deleting it keeps the value from being sent twice.
      u.searchParams.delete(queryKey);
      boundQueryKeys.push(queryKey);
      return;
    }
    unfilled.push(placeholder);
  });

  u.pathname = `/${segments.join('/')}`;
  for (const [key, value] of remaining) {
    if (Array.isArray(value)) {
      for (const item of value) u.searchParams.append(key, String(item));
    } else if (typeof value === 'object') {
      u.searchParams.append(key, JSON.stringify(value));
    } else {
      u.searchParams.append(key, String(value));
    }
  }
  return { url: u.toString(), unfilled, boundKeys, boundQueryKeys };
}

// Thrown before any USDC moves, so it states plainly that nothing was spent.
export function unfilledPlaceholderMessage(
  url: string,
  unfilled: PathPlaceholder[],
  data: Record<string, unknown>,
): string {
  const names = unfilled.map(p => `\`${p.name}\``).join(', ');
  let queryKeys: string[] = [];
  try {
    queryKeys = [...new URL(url).searchParams.keys()];
  } catch {
    queryKeys = [];
  }
  // Count what the URL carries as supplied too, or the message reports "none" for a URL the
  // reader can see holds parameters.
  const supplied = [...new Set([...Object.keys(data), ...queryKeys])];
  const suppliedList = supplied.length ? supplied.map(k => `\`${k}\``).join(', ') : 'none';
  return (
    `Not paying ${url}: its path still contains the unfilled parameter ${names}, which is a ` +
    'template placeholder rather than a real value. The server would read the placeholder ' +
    'literally and reject the request, and x402 charges before that happens, so submitting it ' +
    'as-is would spend USDC on a guaranteed failure. NO PAYMENT WAS MADE and none is needed to ' +
    `fix this.\n\nSupply a value for ${names} in the request data (fields supplied: ` +
    `${suppliedList}), or call the URL with the value already substituted into the path. ` +
    "Check the service's description and input schema for what the parameter means."
  );
}
