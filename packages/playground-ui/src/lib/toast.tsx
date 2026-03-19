import { X, CircleCheck, CircleX, CircleAlert, Info } from 'lucide-react';
import React from 'react';
import { ExternalToast, toast as sonnerToast } from 'sonner';

import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export { Toaster } from 'sonner';

const defaultOptions: ExternalToast = {
  duration: 5000,
  cancel: {
    label: (
      <Icon>
        <X />
      </Icon>
    ),
    onClick: () => {},
  },
  unstyled: true,
  classNames: {
    toast:
      'bg-surface3 w-full h-auto rounded-lg gap-2 border border-border1 px-3 py-2 flex items-center justify-between pointer-events-auto shadow-card [&>[data-content]]:flex-1',
    title: 'text-xs font-medium text-neutral5',
    description: 'text-xs text-neutral3',
    cancelButton:
      '!bg-transparent hover:!bg-surface2 !border-none !rounded-md !p-1.5 !m-0 !text-neutral3 hover:!text-neutral6 shrink-0 transition-all',
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
    icon: (
      <Icon className="text-accent1 shrink-0">
        <CircleCheck />
      </Icon>
    ),
    classNames: {
      ...options.classNames,
      toast: cn('bg-accent1Darker border-accent1/30 border-l-[3px] border-l-accent1', options.classNames?.toast),
      title: cn('text-xs text-neutral5', options.classNames?.title),
      description: cn('text-xs text-neutral4', options.classNames?.description),
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
    icon: (
      <Icon className="text-accent2 shrink-0">
        <CircleX />
      </Icon>
    ),
    classNames: {
      ...options.classNames,
      toast: cn('bg-accent2Darker border-accent2/30 border-l-[3px] border-l-accent2', options.classNames?.toast),
      title: cn('text-xs text-neutral5', options.classNames?.title),
      description: cn('text-xs text-neutral4', options.classNames?.description),
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
    icon: (
      <Icon className="text-accent6 shrink-0">
        <CircleAlert />
      </Icon>
    ),
    classNames: {
      ...options.classNames,
      toast: cn('bg-accent6Darker border-accent6/30 border-l-[3px] border-l-accent6', options.classNames?.toast),
      title: cn('text-xs text-neutral5', options.classNames?.title),
      description: cn('text-xs text-neutral4', options.classNames?.description),
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
    icon: (
      <Icon className="text-accent3 shrink-0">
        <Info />
      </Icon>
    ),
    classNames: {
      ...options.classNames,
      toast: cn('bg-accent3Darker border-accent3/30 border-l-[3px] border-l-accent3', options.classNames?.toast),
      title: cn('text-xs text-neutral5', options.classNames?.title),
      description: cn('text-xs text-neutral4', options.classNames?.description),
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
