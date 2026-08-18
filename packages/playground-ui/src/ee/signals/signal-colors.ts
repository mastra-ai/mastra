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

const MINIMUM_HUE_DISTANCE = 30;
const RESERVED_HUES = [0, ...Object.values(SIGNAL_HUES)];
const CUSTOM_SIGNAL_HUES = Array.from({ length: 360 }, (_, hue) => hue).filter(hue =>
  RESERVED_HUES.every(reservedHue => circularHueDistance(hue, reservedHue) >= MINIMUM_HUE_DISTANCE),
);

function customSignalHue(signalName: string): number {
  let hash = 0;
  for (const character of signalName.toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  const hue = CUSTOM_SIGNAL_HUES[hash % CUSTOM_SIGNAL_HUES.length];
  if (hue === undefined) throw new Error('Custom signal hue palette is empty');
  return hue;
}

function circularHueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}
