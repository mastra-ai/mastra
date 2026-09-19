import { Circle, Hammer, Map, Zap } from 'lucide-react';

export function ModeIcon({ modeId }: { modeId: string }) {
  const icons = { build: Hammer, plan: Map, fast: Zap };
  const normalizedId = modeId.toLowerCase();
  const Icon =
    normalizedId === 'build' || normalizedId === 'plan' || normalizedId === 'fast' ? icons[normalizedId] : Circle;
  return <Icon size={12} aria-hidden />;
}
