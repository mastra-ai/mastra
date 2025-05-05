import { SpanProps } from '@/ds/components/TraceTree/Span';
import { Span } from '../types';

export const getSpanVariant = (span: Span): SpanProps['variant'] => {
  const attributes = Object.keys(span.attributes || {}).map(k => k.toLowerCase());
  const lowerCaseName = span.name.toLowerCase();

  const isAiSpan = lowerCaseName.startsWith('ai.');

  if (isAiSpan) {
    const isAiAboutTool = lowerCaseName.includes('tool');
    if (isAiAboutTool) return 'tool';

    return 'other';
  }

  const hasMemoryRelatedAttributes = attributes.some(key => key.includes('memory') || key.includes('storage'));
  if (hasMemoryRelatedAttributes) return 'memory';

  const hasToolRelatedAttributes = attributes.some(key => key.includes('tool'));
  if (hasToolRelatedAttributes) return 'tool';

  const hasAgentRelatedAttributes = attributes.some(key => key.includes('agent.'));
  if (hasAgentRelatedAttributes) return 'agent';

  if (lowerCaseName.includes('.insert')) {
    const evalRelatedAttribute = attributes.find(key => String(span.attributes?.[key])?.includes('mastra_evals'));
    if (evalRelatedAttribute) return 'eval';
  }

  return 'other';
};
