export const SIGNAL_HUES = {
  goal: 145,
  outcome: 35,
  behavior: 225,
  sentiment: 300,
} as const;

export function getSignalHue(signalName: string) {
  switch (signalName.toLowerCase()) {
    case 'goal':
      return SIGNAL_HUES.goal;
    case 'outcome':
      return SIGNAL_HUES.outcome;
    case 'behavior':
      return SIGNAL_HUES.behavior;
    case 'sentiment':
      return SIGNAL_HUES.sentiment;
    default:
      return customSignalHue(signalName);
  }
}

const BUILT_IN_HUES = Object.values(SIGNAL_HUES);
const MINIMUM_HUE_DISTANCE = 30;

function customSignalHue(signalName: string): number {
  let hash = 0;
  for (const character of signalName) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  let hue = hash % 360;
  while (BUILT_IN_HUES.some(builtInHue => circularHueDistance(hue, builtInHue) < MINIMUM_HUE_DISTANCE)) {
    hue = (hue + MINIMUM_HUE_DISTANCE) % 360;
  }
  return hue;
}

function circularHueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}
