import { hashLabel } from '@/lib/colors';

type SignalHue = 'green' | 'orange' | 'blue' | 'purple' | 'pink' | 'red' | 'yellow';

const SIGNAL_HUES: Record<string, SignalHue> = {
  goal: 'green',
  outcome: 'orange',
  behavior: 'blue',
  sentiment: 'purple',
};

const CUSTOM_SIGNAL_HUES: SignalHue[] = ['pink', 'red', 'yellow'];

const SIGNAL_AREA_CLASS: Record<SignalHue, string> = {
  green: 'fill-green-100 dark:fill-green-soft-950',
  orange: 'fill-orange-100 dark:fill-orange-soft-950',
  blue: 'fill-blue-100 dark:fill-blue-soft-950',
  purple: 'fill-purple-100 dark:fill-purple-soft-950',
  pink: 'fill-pink-100 dark:fill-pink-soft-950',
  red: 'fill-red-100 dark:fill-red-soft-950',
  yellow: 'fill-yellow-100 dark:fill-yellow-soft-950',
};

const SIGNAL_CONNECTOR_CLASS: Record<SignalHue, string> = {
  green: 'stroke-green-300 dark:stroke-green-700',
  orange: 'stroke-orange-300 dark:stroke-orange-700',
  blue: 'stroke-blue-300 dark:stroke-blue-700',
  purple: 'stroke-purple-300 dark:stroke-purple-700',
  pink: 'stroke-pink-300 dark:stroke-pink-700',
  red: 'stroke-red-300 dark:stroke-red-700',
  yellow: 'stroke-yellow-300 dark:stroke-yellow-700',
};

function getSignalHue(signalName: string): SignalHue {
  const name = signalName.toLowerCase();
  return SIGNAL_HUES[name] ?? CUSTOM_SIGNAL_HUES[hashLabel(name) % CUSTOM_SIGNAL_HUES.length] ?? 'pink';
}

export function getSignalColor(signalName: string) {
  return `var(--chart-${getSignalHue(signalName)})`;
}

export function getSignalAreaClass(signalName: string) {
  return SIGNAL_AREA_CLASS[getSignalHue(signalName)];
}

export function getSignalConnectorClass(signalName: string) {
  return SIGNAL_CONNECTOR_CLASS[getSignalHue(signalName)];
}
