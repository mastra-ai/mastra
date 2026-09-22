export const stringToColor = (str: string, lightness: number = 90, saturation = 100) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
};

/** A hue rendered with the theme's lightness for generated accents (see `--generated-accent-lightness`). */
export const themedHueColor = (hue: number, saturation = 60) =>
  `hsl(${hue} ${saturation}% var(--generated-accent-lightness, 60%))`;

/** `stringToColor` counterpart: same stable hue, lightness follows the active theme. */
export const stringToThemedColor = (str: string, saturation = 60) => {
  const hue = Number(stringToColor(str).match(/hsl\((-?\d+)/)?.[1] ?? 0);
  return themedHueColor(hue, saturation);
};
