import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import type { ExternalToast } from 'sonner';
import { toast as sonnerToast } from 'sonner';

import { ButtonLabel } from '@/ds/components/Button/Button';

// Forward sonner's return value so callers can update/dismiss by id later.
const forEachOrOnce = <M, R>(message: M | M[], emit: (m: M) => R): R | R[] =>
  Array.isArray(message) ? message.map(emit) : emit(message);

function linkAction(action: ExternalToast['action']) {
  if (!action || typeof action !== 'object' || !('label' in action)) return action;
  return { ...action, label: <ButtonLabel variant="link">{action.label}</ButtonLabel> };
}

function linkActions(options: ExternalToast): ExternalToast {
  const linked = { ...options };
  if (options.action !== undefined) linked.action = linkAction(options.action);
  if (options.cancel !== undefined) linked.cancel = linkAction(options.cancel);
  return linked;
}

export const toast = (message: string | string[] | ReactNode, options: ExternalToast = {}) => {
  if (Array.isArray(message)) return message.map(m => sonnerToast(m, linkActions(options)));
  if (isValidElement(message) || typeof message === 'string') return sonnerToast(message, linkActions(options));
  throw new Error('Invalid message type');
};

toast.success = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.success(m, linkActions(options)));
toast.error = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.error(m, linkActions(options)));
toast.warning = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.warning(m, linkActions(options)));
toast.info = (message: string | string[], options: ExternalToast = {}) =>
  forEachOrOnce(message, m => sonnerToast.info(m, linkActions(options)));

toast.custom = (message: ReactNode, options: ExternalToast = {}) => sonnerToast(message, linkActions(options));

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
    success: (data: T) => {
      onSuccess?.(data);
      return successMessage;
    },
    error: (err: unknown) => {
      onError?.(err);
      if (errorMessage) return errorMessage;
      if (err instanceof Error) return err.message;
      return 'Error...';
    },
    ...linkActions(options),
  });
