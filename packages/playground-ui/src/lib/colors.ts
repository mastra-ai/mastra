export const categoricalHues = ['blue', 'green', 'orange', 'purple', 'pink', 'amber', 'cyan'] as const;

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

export const hueAccentColor = (hue: CategoricalHue) => `var(--badge-${hue}-indicator)`;

const HUE_FILL_CLASS: Record<CategoricalHue, string> = {
  blue: 'bg-badge-blue-strong text-badge-blue-foreground',
  green: 'bg-badge-green-strong text-badge-green-foreground',
  orange: 'bg-badge-orange-strong text-badge-orange-foreground',
  purple: 'bg-badge-purple-strong text-badge-purple-foreground',
  pink: 'bg-badge-pink-strong text-badge-pink-foreground',
  amber: 'bg-badge-amber-strong text-badge-amber-foreground',
  cyan: 'bg-badge-cyan-strong text-badge-cyan-foreground',
};

export const hueFillClass = (hue: CategoricalHue) => HUE_FILL_CLASS[hue];

export const hueColors = (hue: CategoricalHue) => ({
  background: `var(--badge-${hue}-strong)`,
  foreground: `var(--badge-${hue}-foreground)`,
  tint: `var(--badge-${hue}-indicator)`,
});
