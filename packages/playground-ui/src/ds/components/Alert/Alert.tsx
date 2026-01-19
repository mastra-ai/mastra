import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { AlertCircle, InfoIcon, TriangleAlert } from 'lucide-react';
import React from 'react';
import { Txt, TxtProps } from '../Txt';
import { transitions } from '@/ds/primitives/transitions';

type AlertVariant = 'warning' | 'destructive' | 'info';

export interface AlertProps {
  children: React.ReactNode;
  variant: AlertVariant;
  className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
  warning: 'bg-accent6Darker border-accent6/30 text-accent6',
  destructive: 'bg-accent2Darker border-accent2/30 text-accent2',
  info: 'bg-accent5Darker border-accent5/30 text-accent5',
};

const variantIcons: Record<AlertVariant, React.FC<React.SVGProps<SVGSVGElement>>> = {
  warning: TriangleAlert,
  destructive: AlertCircle,
  info: InfoIcon,
};

export const Alert = ({ children, variant = 'destructive', className }: AlertProps) => {
  const Ico = variantIcons[variant];
  return (
    <div
      className={cn(
        variantClasses[variant],
        'p-3 rounded-md border shadow-sm',
        transitions.all,
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 flex-shrink-0">
          <Ico />
        </Icon>
        <div className="text-neutral4">{children}</div>
      </div>
    </div>
  );
};

export const AlertTitle = ({ children, as: As = 'h5' }: { children: React.ReactNode; as?: TxtProps['as'] }) => {
  return (
    <Txt as={As} variant="ui-md" className="font-semibold">
      {children}
    </Txt>
  );
};

export const AlertDescription = ({ children, as: As = 'p' }: { children: React.ReactNode; as: TxtProps['as'] }) => {
  return (
    <Txt as={As} variant="ui-sm">
      {children}
    </Txt>
  );
};
