import { backgrounds, fixedColors, gray, hues } from './token-registry.mjs';

const linearize = value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = hex => {
  const [red, green, blue] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(value =>
    linearize(Number.parseInt(value, 16) / 255),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

const checks = [
  ['text-primary dark', gray[10].dark, backgrounds[2].dark, 7],
  ['text-primary light', gray[10].light, backgrounds[2].light, 7],
  ['text-secondary dark', gray[9].dark, backgrounds[2].dark, 7],
  ['text-secondary light', gray[9].light, backgrounds[2].light, 7],
  ['text-on-contrast dark', backgrounds[1].dark, gray[10].dark, 7],
  ['text-on-contrast light', backgrounds[1].light, gray[10].light, 7],
  ['color-success dark', hues.green[9].dark, backgrounds[2].dark, 4.5],
  ['color-success light', hues.green[9].light, backgrounds[2].light, 4.5],
  ['color-warning dark', hues.orange[9].dark, backgrounds[2].dark, 4.5],
  ['color-warning light', hues.orange[9].light, backgrounds[2].light, 4.5],
  ['color-error dark', hues.red[9].dark, backgrounds[2].dark, 4.5],
  ['color-error light', hues.red[9].light, backgrounds[2].light, 4.5],
  ['color-info dark', hues.blue[9].dark, backgrounds[2].dark, 4.5],
  ['color-info light', hues.blue[9].light, backgrounds[2].light, 4.5],
  ...Object.entries(hues).map(([name, scale]) => [
    `text-on-accent on ${name}-7`,
    fixedColors.black.dark,
    scale[7].dark,
    4.5,
  ]),
];

for (const [name, foreground, background, minimum] of checks) {
  const ratio = contrast(foreground, background);
  if (ratio < minimum) {
    process.stderr.write(`${name} has ${ratio.toFixed(2)}:1 contrast; expected at least ${minimum}:1\n`);
    process.exitCode = 1;
  }
}
