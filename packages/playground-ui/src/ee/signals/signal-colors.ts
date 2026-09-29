import { hashLabel } from '@/lib/colors';

type SignalHue = 'green' | 'orange' | 'blue' | 'purple' | 'pink' | 'yellow';

const SIGNAL_HUES: Record<string, SignalHue> = {
  goal: 'green',
  outcome: 'orange',
  behavior: 'blue',
  sentiment: 'purple',
};

const CUSTOM_SIGNAL_HUES: SignalHue[] = ['pink', 'yellow'];

const SIGNAL_AREA_CLASS: Record<SignalHue, string> = {
  green: 'fill-badge-green-indicator opacity-15',
  orange: 'fill-badge-orange-indicator opacity-15',
  blue: 'fill-badge-blue-indicator opacity-15',
  purple: 'fill-badge-purple-indicator opacity-15',
  pink: 'fill-badge-pink-indicator opacity-15',
  yellow: 'fill-badge-yellow-indicator opacity-15',
};

const SIGNAL_CONNECTOR_CLASS: Record<SignalHue, string> = {
  green: 'stroke-badge-green-edge',
  orange: 'stroke-badge-orange-edge',
  blue: 'stroke-badge-blue-edge',
  purple: 'stroke-badge-purple-edge',
  pink: 'stroke-badge-pink-edge',
  yellow: 'stroke-badge-yellow-edge',
};

function getSignalHue(signalName: string): SignalHue {
  const name = signalName.toLowerCase();
  const builtInHue = Object.hasOwn(SIGNAL_HUES, name) ? SIGNAL_HUES[name] : undefined;
  return builtInHue ?? CUSTOM_SIGNAL_HUES[hashLabel(name) % CUSTOM_SIGNAL_HUES.length] ?? 'pink';
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
