import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface ValidationStatusProps {
  state: ValidationState;
  message?: string;
  className?: string;
}

export function ValidationStatus({ state, message, className }: ValidationStatusProps) {
  if (state === 'idle') {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {state === 'validating' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-accent1" />
          <span className="text-neutral6">Validating...</span>
        </>
      )}
      {state === 'valid' && (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-green-500">{message ?? 'Valid'}</span>
        </>
      )}
      {state === 'invalid' && (
        <>
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-500">{message ?? 'Invalid'}</span>
        </>
      )}
    </div>
  );
}
