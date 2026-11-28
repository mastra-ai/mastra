import { connectEventFieldTable } from './event-payloads/event-fields.generated.js';

/** A value a payload field is matched against. */
export type ConnectEventFieldValue = string | number | boolean;

/**
 * Payload fields an event must have, by path from `connectEventFields`: a value, or a list of
 * values any of which matches. `issue.labels[].name: 'bug'` matches an issue with any label named
 * `bug`. Strings match exactly.
 */
export type ConnectEventFieldFilters = {
  readonly [path: string]: ConnectEventFieldValue | readonly ConnectEventFieldValue[];
};

/**
 * The payload fields an event type can be filtered on, such as `pull_request.number` or
 * `issue.labels[].name`: plain values up to three objects deep, without link fields. `undefined`
 * when Connect has no payload type for the event.
 */
export function connectEventFields(provider: string, eventType: string): readonly string[] | undefined {
  const table = Object.hasOwn(connectEventFieldTable, provider) ? connectEventFieldTable[provider] : undefined;
  const indexes = table && Object.hasOwn(table.events, eventType) ? table.events[eventType] : undefined;
  return indexes?.map(index => table!.fields[index]!);
}

/**
 * The filter paths an event type's payload doesn't have. Empty when every path is known, and
 * when Connect has no payload type for the event, since its fields can't be checked.
 */
export function unknownConnectEventFields(
  provider: string,
  eventType: string,
  filters: ConnectEventFieldFilters,
): string[] {
  const fields = connectEventFields(provider, eventType);
  if (!fields) return [];
  const known = new Set(fields);
  return Object.keys(filters).filter(path => !known.has(path));
}

/** Whether a payload has every filtered field with one of its values. */
export function matchesConnectEventFields(payload: unknown, filters: ConnectEventFieldFilters): boolean {
  return Object.entries(filters).every(([path, wanted]) => {
    const values = Array.isArray(wanted) ? wanted : [wanted];
    return fieldValues(payload, path.split(/\.|(?=\[\])/)).some(value => values.includes(value as never));
  });
}

/** The values at a path; `[]` steps into every element of an array. */
function fieldValues(value: unknown, steps: string[]): unknown[] {
  if (steps.length === 0) return [value];
  const [step, ...rest] = steps as [string, ...string[]];
  if (step === '[]') return Array.isArray(value) ? value.flatMap(element => fieldValues(element, rest)) : [];
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, step)) return [];
  return fieldValues((value as Record<string, unknown>)[step], rest);
}
