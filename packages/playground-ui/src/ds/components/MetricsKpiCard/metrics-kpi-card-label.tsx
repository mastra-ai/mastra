import { Txt } from '@/ds/components/Txt';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Txt as="span" variant="subheading" tone="ink" className={className}>
      {children}
    </Txt>
  );
}
