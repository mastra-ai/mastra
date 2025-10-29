import { X } from 'lucide-react';
import React from 'react';
import { ExternalToast, toast as sonnerToast } from 'sonner';

import { cn } from '@/lib/utils';

export { Toaster } from 'sonner';

const defaultOptions: ExternalToast = {
  duration: 3000,
  cancel: {
    label: <X size={'14'} />,
    onClick: () => {},
  },
  unstyled: true,
  classNames: {
    toast:
      'bg-[#0F0F0F] w-full backdrop-accent h-auto rounded-lg gap-2 border border p-4 flex items-start rounded-lg pointer-events-auto',
    title: 'text-white font-semibold text-xs mb-1 -mt-1',
    description: '!text-text text-sm !font-light',
    cancelButton:
      'self-start !bg-transparent !p-0 flex items-center justify-center !text-text opacity-50 order-last hover:opacity-100',
    actionButton: '!bg-white flex items-center justify-center font-medium !text-black order-last hover:opacity-80',
  },
};

/**
 * Create a new toast options object with the default options and the given options.
 *
 * @param options The options to use for the toast.
 * @returns The toast options object.
 */
function getToastOptions(options: ExternalToast): ExternalToast {
  const { classNames, ...rest } = defaultOptions;
  const { classNames: optionsClassNames, ...restOptions } = options || {};

  return {
    ...rest,
    classNames: {
      ...classNames,
      title: cn(classNames?.title, 'mt-auto', optionsClassNames?.title),
      toast: cn(classNames?.toast, '!items-center', optionsClassNames?.toast),
      cancelButton: cn(classNames?.cancelButton, '!self-center', optionsClassNames?.cancelButton),
      actionButton: cn(classNames?.actionButton, optionsClassNames?.actionButton),
    },
    ...restOptions,
  };
}

export const toast = (message: string | string[] | React.ReactNode, options: ExternalToast = {}) => {
  if (Array.isArray(message)) {
    return message.forEach(msg => sonnerToast(msg, getToastOptions(options)));
  } else if (React.isValidElement(message)) {
    return sonnerToast(message, getToastOptions(options));
  } else if (typeof message === 'string') {
    return sonnerToast(message, getToastOptions(options));
  }
  throw new Error('Invalid message type');
};

toast.success = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      return sonnerToast.success(message, getToastOptions(options));
    case 'object':
      return message.forEach(message => sonnerToast.success(message, getToastOptions(options)));
  }
};
toast.error = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      return sonnerToast.error(message, getToastOptions(options));
    case 'object':
      return message.forEach(message => sonnerToast.error(message, getToastOptions(options)));
  }
};
toast.warning = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      return sonnerToast.warning(message, getToastOptions(options));
    case 'object':
      return message.forEach(message => sonnerToast.warning(message, getToastOptions(options)));
  }
};
toast.info = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      return sonnerToast.info(message, getToastOptions(options));
    case 'object':
      return message.forEach(message => sonnerToast.info(message, getToastOptions(options)));
  }
};

toast.custom = (message: React.ReactNode, options: ExternalToast = {}) => {
  return sonnerToast(message, getToastOptions(options));
};

toast.dismiss = (toastId: string | number | null | undefined) => {
  if (toastId) {
    sonnerToast.dismiss(toastId);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
toast.promise = <T extends unknown>({
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
  onError?: (err: T) => void;
  options?: ExternalToast;
}) => {
  return sonnerToast.promise(myPromise, {
    loading: loadingMessage ?? 'Loading...',
    success: data => {
      onSuccess?.(data);
      return successMessage;
    },
    error: err => {
      onError?.(err);
      return errorMessage || err?.message || 'Error...';
    },
    ...getToastOptions(options),
  });
};
