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
      return 0;
  }
}
