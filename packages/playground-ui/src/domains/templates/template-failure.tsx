import { FrownIcon } from 'lucide-react';
import { Container } from './shared';
import { cn } from '@/lib/utils';

type TemplateFailureProps = {
  errorMsg?: string;
};

export function TemplateFailure({ errorMsg }: TemplateFailureProps) {
  return (
    <Container
      className={cn(
        'grid items-center justify-items-center gap-[1rem] content-center',
        '[&>svg]:w-[2rem] [&>svg]:h-[2rem]',
      )}
    >
      <FrownIcon />
      <p className="text-[0.875rem] text-center text-icon3">{errorMsg || 'Template installation failed'}</p>
    </Container>
  );
}
