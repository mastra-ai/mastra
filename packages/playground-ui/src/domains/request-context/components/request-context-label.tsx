import type { ReactNode } from 'react';
import { FieldLabel } from '@/ds/components/Field';

interface RequestContextLabelProps {
  children: ReactNode;
  tooltip?: string;
}

/** @deprecated Use `<FieldLabel info={tooltip}>` from `@mastra/playground-ui/components/Field`. */
export function RequestContextLabel({ children, tooltip }: RequestContextLabelProps) {
  return <FieldLabel info={tooltip}>{children}</FieldLabel>;
}
