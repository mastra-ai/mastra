type PredefinedLightness = 90 | 25 | 75 | 95;

export const stringToColor = (str: string, lightness: PredefinedLightness = 75, saturation = 100) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
};
