import { Icon } from '@/ds/icons';
import clsx from 'clsx';
import { AlertCircle, InfoIcon, TriangleAlert } from 'lucide-react';
import React from 'react';
import { Txt, TxtProps } from '../Txt';

type AlertVariant = 'warning' | 'destructive' | 'info';

export interface AlertProps {
  children: React.ReactNode;
  variant: AlertVariant;
}

const variantClasses: Record<AlertVariant, string> = {
  warning: 'bg-yellow-900/20 border-sm border-yellow-200 text-yellow-200',
  destructive: 'bg-red-900/20 border-sm border-red-200 text-red-200',
  info: 'bg-blue-900/20 border-sm border-blue-200 text-blue-200',
};

const variantIcons: Record<AlertVariant, React.FC<React.SVGProps<SVGSVGElement>>> = {
  warning: TriangleAlert,
  destructive: AlertCircle,
  info: InfoIcon,
};

export const Alert = ({ children, variant = 'destructive' }: AlertProps) => {
  const Ico = variantIcons[variant];
  return (
    <div className={clsx(variantClasses[variant], 'p-2 rounded-md')}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5">
          <Ico />
        </Icon>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const AlertTitle = ({ children, as: As = 'h5' }: { children: React.ReactNode; as: TxtProps['as'] }) => {
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
