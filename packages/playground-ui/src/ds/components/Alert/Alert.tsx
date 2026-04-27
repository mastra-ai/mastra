import { AlertCircle, InfoIcon, TriangleAlert } from 'lucide-react';
import React from 'react';
import { Notice, type NoticeVariant } from '../Notice';
import type { TxtProps } from '../Txt';

type AlertVariant = Extract<NoticeVariant, 'warning' | 'destructive' | 'info'>;

export interface AlertProps {
  children: React.ReactNode;
  variant: AlertVariant;
  className?: string;
}

const variantIcons: Record<AlertVariant, React.FC<React.SVGProps<SVGSVGElement>>> = {
  warning: TriangleAlert,
  destructive: AlertCircle,
  info: InfoIcon,
};

/**
 * @deprecated Use `<Notice>` from `@/ds/components/Notice` instead. Alert is a thin
 * compatibility wrapper and will be removed in a future major release.
 */
export const Alert = ({ children, variant = 'destructive', className }: AlertProps) => {
  const Ico = variantIcons[variant];
  return (
    <Notice variant={variant} className={className}>
      <Ico />
      <Notice.Column>{children}</Notice.Column>
    </Notice>
  );
};

/**
 * @deprecated Use `<Notice.Title>` instead.
 */
export const AlertTitle = ({ children }: { children: React.ReactNode; as?: TxtProps['as'] }) => {
  return <Notice.Title>{children}</Notice.Title>;
};

/**
 * @deprecated Use `<Notice.Message>` instead.
 */
export const AlertDescription = ({ children }: { children: React.ReactNode; as?: TxtProps['as'] }) => {
  return <Notice.Message>{children}</Notice.Message>;
};
