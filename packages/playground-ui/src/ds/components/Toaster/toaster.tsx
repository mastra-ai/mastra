import { InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import type { ToasterProps as SonnerToasterProps } from 'sonner';
import { Toaster as SonnerToaster } from 'sonner';
import { BrandLoader } from '../BrandLoader/brand-loader';
import { buttonVariants } from '../Button/Button';
import { useToastLayout } from './use-toast-layout';
import { cn } from '@/lib/utils';
import './toaster.css';

export interface ToasterProps extends SonnerToasterProps {
  variant?: 'default' | 'neutral';
}

export const Toaster = ({ className, toastOptions, icons, variant = 'default', ...rest }: ToasterProps) => {
  const rootRef = useToastLayout();
  return (
    <SonnerToaster
      ref={rootRef}
      {...rest}
      closeButton
      icons={{
        success: <LightbulbIcon aria-hidden />,
        error: <OctagonAlertIcon aria-hidden />,
        warning: <TriangleAlertIcon aria-hidden />,
        info: <InfoIcon aria-hidden />,
        loading: (
          <span aria-hidden className="flex">
            <BrandLoader
              size="sm"
              className={cn('toast-promise-loader w-5', {
                'toast-promise-success': icons?.success === undefined,
                'toast-promise-error': icons?.error === undefined,
              })}
            />
          </span>
        ),
        ...icons,
      }}
      className={cn('mastra-toaster', variant === 'neutral' && 'mastra-toaster-neutral', className)}
      toastOptions={{
        duration: 5000,
        ...toastOptions,
        classNames: {
          actionButton: buttonVariants({ variant: 'link' }),
          cancelButton: buttonVariants({ variant: 'link' }),
          ...toastOptions?.classNames,
        },
      }}
    />
  );
};
