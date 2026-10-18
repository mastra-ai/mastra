/**
 * Structured, fail-closed scanner for artifacts emitted by the Security evaluation
 * pipeline. It examines keys and scalar leaves recursively rather than relying
 * on one concatenated string, so a canary cannot hide in JSON encoded inside a
 * log, report, score or read-model field.
 */
export type RedactionSurface = Readonly<{ name: string; value: unknown }>;

const prohibitedKey =
  /^(?:authorization|cookie|token|secret|password|api_?key|body|prompt|email|ip|name|evidence|chain_?of_?thought)$/iu;

export function scanRedactionSurfaces(
  surfaces: readonly RedactionSurface[],
  canaries: readonly string[],
): readonly string[] {
  const errors: string[] = [];
  const visit = (surface: string, value: unknown, path: string): void => {
    if (value instanceof Uint8Array) {
      visit(surface, new TextDecoder().decode(value), `${path}:utf8`);
      return;
    }
    if (typeof value === 'string') {
      for (const canary of canaries) if (value.includes(canary)) errors.push(`canary:${surface}:${path}`);
      // Serialized JSON appears in a few public storage fields. Recurse into
      // it when possible so field allowlists still apply.
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) visit(surface, parsed, `${path}:json`);
      } catch {
        // Normal scalar strings are already scanned above.
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(surface, item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (prohibitedKey.test(key)) errors.push(`forbidden-key:${surface}:${path}.${key}`);
      visit(surface, item, `${path}.${key}`);
    }
  };
  for (const surface of surfaces) visit(surface.name, surface.value, '$');
  return Object.freeze([...new Set(errors)]);
}
