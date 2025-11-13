import { X } from 'lucide-react';
import React from 'react';
import { ExternalToast, toast as sonnerToast } from 'sonner';

import { cn } from '@/lib/utils';

export { Toaster } from 'sonner';

const defaultOptions: ExternalToast = {
  duration: 5000,
  cancel: {
    label: <X size={'14'} />,
    onClick: () => {},
  },
  unstyled: true,
  classNames: {
    toast:
      'bg-[#0F0F0F] w-full backdrop-accent h-auto rounded-lg gap-2 border border p-4 flex items-start justify-between rounded-lg pointer-events-auto',
    title: 'text-white font-semibold text-xs mb-1 -mt-1',
    description: '!text-text text-sm !font-light',
    cancelButton:
      '!bg-transparent !p-0 flex items-center justify-center !text-text opacity-50 hover:opacity-100 ml-4 shrink-0',
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
      title: cn(classNames?.title, optionsClassNames?.title),
      toast: cn(classNames?.toast, optionsClassNames?.toast),
      cancelButton: cn(classNames?.cancelButton, optionsClassNames?.cancelButton),
      actionButton: cn(classNames?.actionButton, optionsClassNames?.actionButton),
      description: cn(classNames?.description, optionsClassNames?.description),
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
  const successOptions: ExternalToast = {
    ...options,
    classNames: {
      ...options.classNames,
      toast: cn(
        'bg-green-950/20 border-green-900/50 dark:bg-green-950/20 dark:border-green-900/50',
        options.classNames?.toast,
      ),
      title: cn('text-green-200 dark:text-green-200', options.classNames?.title),
      description: cn('text-green-300 dark:text-green-300', options.classNames?.description),
    },
  };

  switch (typeof message) {
    case 'string':
      return sonnerToast.success(message, getToastOptions(successOptions));
    case 'object':
      return message.forEach(message => sonnerToast.success(message, getToastOptions(successOptions)));
  }
};
toast.error = (message: string | string[], options: ExternalToast = {}) => {
  const errorOptions: ExternalToast = {
    ...options,
    classNames: {
      ...options.classNames,
      toast: cn('bg-red-950/20 border-red-900/50 dark:bg-red-950/20 dark:border-red-900/50', options.classNames?.toast),
      title: cn('text-red-200 dark:text-red-200', options.classNames?.title),
      description: cn('text-red-300 dark:text-red-300', options.classNames?.description),
    },
  };

  switch (typeof message) {
    case 'string':
      return sonnerToast.error(message, getToastOptions(errorOptions));
    case 'object':
      return message.forEach(message => sonnerToast.error(message, getToastOptions(errorOptions)));
  }
};
toast.warning = (message: string | string[], options: ExternalToast = {}) => {
  const warningOptions: ExternalToast = {
    ...options,
    classNames: {
      ...options.classNames,
      toast: cn(
        'bg-yellow-950/20 border-yellow-900/50 dark:bg-yellow-950/20 dark:border-yellow-900/50',
        options.classNames?.toast,
      ),
      title: cn('text-yellow-200 dark:text-yellow-200', options.classNames?.title),
      description: cn('text-yellow-300 dark:text-yellow-300', options.classNames?.description),
    },
  };

  switch (typeof message) {
    case 'string':
      return sonnerToast.warning(message, getToastOptions(warningOptions));
    case 'object':
      return message.forEach(message => sonnerToast.warning(message, getToastOptions(warningOptions)));
  }
};
toast.info = (message: string | string[], options: ExternalToast = {}) => {
  const infoOptions: ExternalToast = {
    ...options,
    classNames: {
      ...options.classNames,
      toast: cn(
        'bg-blue-950/20 border-blue-900/50 dark:bg-blue-950/20 dark:border-blue-900/50',
        options.classNames?.toast,
      ),
      title: cn('text-blue-200 dark:text-blue-200', options.classNames?.title),
      description: cn('text-blue-300 dark:text-blue-300', options.classNames?.description),
    },
  };

  switch (typeof message) {
    case 'string':
      return sonnerToast.info(message, getToastOptions(infoOptions));
    case 'object':
      return message.forEach(message => sonnerToast.info(message, getToastOptions(infoOptions)));
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
