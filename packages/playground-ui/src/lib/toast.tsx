import type { ReactNode } from 'react';
import React from 'react';
import type { ExternalToast, ToasterProps } from 'sonner';
import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';

import { cn } from '@/lib/utils';

import './toast.css';

// All theming lives in `.mastra-toaster` (see toast.css) — sonner reads --success-bg / --error-bg / etc.
// from richColors mode. `rest` is spread first so callers can't override the closeButton / richColors
// contract (sonner's per-type tinted colors only kick in with richColors, and the close button is the
// only built-in dismiss affordance we expose).
export const Toaster = ({ className, toastOptions, ...rest }: ToasterProps) => (
  <SonnerToaster
    {...rest}
    closeButton
    richColors
    className={cn('mastra-toaster', className)}
    toastOptions={{ duration: 5000, ...toastOptions }}
  />
);

// Forward sonner's return value so callers can update/dismiss by id later.
const forEachOrOnce = <M, R>(message: M | M[], emit: (m: M) => R): R | R[] =>
  Array.isArray(message) ? message.map(emit) : emit(message);

export const toast = (message: string | string[] | ReactNode, options: ExternalToast = {}) => {
  if (Array.isArray(message)) return message.map(m => sonnerToast(m, options));
  if (React.isValidElement(message) || typeof message === 'string') return sonnerToast(message, options);
  throw new Error('Invalid message type');
};

toast.success = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.success(m, options));
toast.error = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.error(m, options));
toast.warning = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.warning(m, options));
toast.info = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.info(m, options));

toast.custom = (message: ReactNode, options: ExternalToast = {}) => sonnerToast(message, options);

toast.dismiss = (toastId?: string | number) => sonnerToast.dismiss(toastId);

toast.promise = <T,>({
  myPromise,
  loadingMessage,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  options = {},
}: {
  myPromise: Promise<T>;
  successMessage: string;
  loadingMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
  options?: ExternalToast;
}) =>
  sonnerToast.promise(myPromise, {
    loading: loadingMessage ?? 'Loading...',
    success: data => {
      onSuccess?.(data);
      return successMessage;
    },
    error: (err: unknown) => {
      onError?.(err);
      if (errorMessage) return errorMessage;
      if (err instanceof Error) return err.message;
      return 'Error...';
    },
    ...options,
  });
