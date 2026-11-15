import type { ToasterProps as SonnerToasterProps } from 'sonner';
import { Toaster as SonnerToaster } from 'sonner';
import { BrandLoader } from '../BrandLoader/brand-loader';
import { buttonVariants } from '../Button/Button';
import { observeToastLayout } from './observe-toast-layout';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconLightBulb } from '@/ds/icons/central/IconLightBulb';
import { cn } from '@/lib/utils';
import './toaster.css';

export interface ToasterProps extends SonnerToasterProps {
  variant?: 'default' | 'neutral';
}

const toneIcons = {
  success: <IconLightBulb aria-hidden />,
  error: <IconExclamationCircle aria-hidden />,
  warning: <IconExclamationTriangle aria-hidden />,
  info: <IconCircleInfo aria-hidden />,
};

const linkButton = buttonVariants({ variant: 'link' });

export const Toaster = ({ className, toastOptions, icons, variant = 'default', ...rest }: ToasterProps) => (
  <SonnerToaster
    ref={observeToastLayout}
    {...rest}
    closeButton
    icons={{
      ...toneIcons,
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
        actionButton: linkButton,
        cancelButton: linkButton,
        ...toastOptions?.classNames,
      },
    }}
  />
);
