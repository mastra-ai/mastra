const MIN_HUE_DISTANCE = 26;

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

export function hashHue(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return normalizeHue(hash);
}

function supportsOklch() {
  return typeof CSS !== 'undefined' && CSS.supports?.('color', 'oklch(62% 0.14 180)') === true;
}

export function nodeColor(hue: number) {
  const normalizedHue = normalizeHue(hue);
  return supportsOklch() ? `oklch(68% 0.13 ${normalizedHue})` : `hsl(${normalizedHue} 42% 62%)`;
}

export function nodeColorVivid(hue: number) {
  const normalizedHue = normalizeHue(hue);
  return supportsOklch() ? `oklch(74% 0.18 ${normalizedHue})` : `hsl(${normalizedHue} 55% 68%)`;
}

export function buildSankeyHueMap(names: string[]) {
  const entries = [...new Set(names)]
    .map(name => ({ name, hue: hashHue(name) }))
    .sort((left, right) => left.hue - right.hue || left.name.localeCompare(right.name));

  for (let pass = 0; pass < 3; pass += 1) {
    for (let iteration = 0; iteration < entries.length * 8; iteration += 1) {
      entries.sort((left, right) => left.hue - right.hue || left.name.localeCompare(right.name));
      let adjusted = false;

      for (let index = 0; index < entries.length; index += 1) {
        const current = entries[index];
        const next = entries[(index + 1) % entries.length];
        if (!current || !next) continue;

        const distance = normalizeHue(next.hue - current.hue);
        if (distance >= MIN_HUE_DISTANCE - Number.EPSILON) continue;

        const adjustment = (MIN_HUE_DISTANCE - distance) / 2;
        current.hue = normalizeHue(current.hue - adjustment);
        next.hue = normalizeHue(next.hue + adjustment);
        adjusted = true;
      }

      if (!adjusted) break;
    }
  }

  return Object.fromEntries(entries.map(({ name, hue }) => [name, normalizeHue(hue)]));
}
