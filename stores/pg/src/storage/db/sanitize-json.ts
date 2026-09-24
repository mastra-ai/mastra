const repair = (value: string): string =>
  value
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
    .replaceAll('\0', '');

function repairJson(value: unknown): unknown {
  if (typeof value === 'string') return repair(value);
  if (Array.isArray(value)) return value.map(repairJson);
  if (value && typeof value === 'object') {
    const repaired: Record<string, unknown> = Object.create(null);
    for (const [key, entry] of Object.entries(value)) {
      const repairedKey = repair(key);
      if (Object.hasOwn(repaired, repairedKey)) {
        throw new Error(`JSON keys collide after PostgreSQL normalization: ${repairedKey}`);
      }
      repaired[repairedKey] = repairJson(entry);
    }
    return repaired;
  }
  return value;
}

/** Serialize JSON values without emitting Unicode sequences PostgreSQL rejects. */
export function toPgJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined || !/\\u(?:0000|[dD][89a-fA-F][0-9a-fA-F]{2})/.test(json)) return json;
  return JSON.stringify(repairJson(JSON.parse(json)));
}
