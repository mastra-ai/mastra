import { getSpanTypeUi } from '@mastra/playground-ui/domains/traces/components/shared';
import type { ExperimentUISpanStyle } from '../types';

const styledSpanTypePrefixes = ['agent', 'workflow', 'model', 'mcp', 'tool', 'workspace'];

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
    bgColor: color ? `color-mix(in oklch, ${color} 10%, transparent)` : undefined,
    typePrefix,
  };
}
