import { getSpanTypeUi } from '@mastra/playground-ui/domains/traces/components/shared';
import type { ExperimentUISpanStyle } from '../types';

const spanBadgeHues: Record<string, string> = {
  agent: 'blue',
  workflow: 'cyan',
  model: 'purple',
  mcp: 'green',
  tool: 'yellow',
  workspace: 'red',
};

const styledSpanTypePrefixes = Object.keys(spanBadgeHues);

export const spanTypePrefixes = [...styledSpanTypePrefixes, 'other'];

export function getExperimentSpanTypeUi(type: string): ExperimentUISpanStyle | null {
  const typePrefix = type?.toLowerCase().split('_')[0] ?? '';

  if (!styledSpanTypePrefixes.includes(typePrefix)) {
    return { typePrefix: 'other' };
  }

  const { icon, color, label } = getSpanTypeUi(typePrefix);

  return {
    icon,
    color,
    label,
    bgColor: `var(--badge-${spanBadgeHues[typePrefix]}-subtle)`,
    typePrefix,
  };
}
