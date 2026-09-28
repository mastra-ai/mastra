export const categoricalHues = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'cyan'] as const;

export type CategoricalHue = (typeof categoricalHues)[number];

export function hashLabel(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export const hueForName = (name: string): CategoricalHue =>
  categoricalHues[hashLabel(name) % categoricalHues.length] ?? 'blue';

export const hueAccentColor = (hue: CategoricalHue) => `var(--badge-${hue}-dot)`;

const HUE_FILL_CLASS: Record<CategoricalHue, string> = {
  blue: 'bg-badge-blue text-badge-blue-fg',
  green: 'bg-badge-green text-badge-green-fg',
  orange: 'bg-badge-orange text-badge-orange-fg',
  purple: 'bg-badge-purple text-badge-purple-fg',
  pink: 'bg-badge-pink text-badge-pink-fg',
  red: 'bg-badge-red text-badge-red-fg',
  yellow: 'bg-badge-yellow text-badge-yellow-fg',
  cyan: 'bg-badge-cyan text-badge-cyan-fg',
};

export const hueFillClass = (hue: CategoricalHue) => HUE_FILL_CLASS[hue];

export const hueColors = (hue: CategoricalHue) => ({
  background: `var(--badge-${hue})`,
  foreground: `var(--badge-${hue}-fg)`,
  tint: `var(--badge-${hue}-dot)`,
});
