import { X } from 'lucide-react';
import { ExternalToast, toast as sonnerToast } from 'sonner';

import { cn } from './utils';

const defaultOptions: ExternalToast = {
  duration: 3000,
  cancel: {
    label: <X width={16} height={16} />,
    onClick: () => {},
  },
  unstyled: true,
  classNames: {
    toast:
      '!bg-panel-2 w-[356px] !h-auto rounded-lg !backdrop-blur-lg gap-2 border border-border-1 p-4 flex items-start rounded-lg',
    title: 'text-text !font-semibold text-xs mb-1 -mt-1',
    description: '!text-text text-sm !font-light',
    cancelButton:
      'self-start !bg-transparent !p-0 flex items-center justify-center !text-text opacity-50 order-last hover:opacity-100',
    actionButton:
      'self-start !bg-white flex items-center justify-center font-medium !text-black order-last hover:opacity-80',
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

  if (!options.description) {
    return {
      ...rest,
      classNames: {
        ...classNames,
        title: cn(classNames?.title, 'mt-auto'),
        toast: cn(classNames?.toast, '!items-center'),
        cancelButton: cn(classNames?.cancelButton, '!self-center'),
      },
      ...options,
    };
  }
  return { ...defaultOptions, ...options };
}

export const toast = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      sonnerToast(message, getToastOptions(options));
      break;
    case 'object':
      message.forEach(message => sonnerToast(message, getToastOptions(options)));
      break;
    default:
      throw new Error('Invalid message type');
  }
};

toast.success = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      sonnerToast.success(message, getToastOptions(options));
      break;
    case 'object':
      message.forEach(message => sonnerToast.success(message, getToastOptions(options)));
      break;
  }
};
toast.error = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      sonnerToast.error(message, getToastOptions(options));
      break;
    case 'object':
      message.forEach(message => sonnerToast.error(message, getToastOptions(options)));
      break;
  }
};
toast.warning = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      sonnerToast.warning(message, getToastOptions(options));
      break;
    case 'object':
      message.forEach(message => sonnerToast.warning(message, getToastOptions(options)));
      break;
  }
};
toast.info = (message: string | string[], options: ExternalToast = {}) => {
  switch (typeof message) {
    case 'string':
      sonnerToast.info(message, getToastOptions(options));
      break;
    case 'object':
      message.forEach(message => sonnerToast.info(message, getToastOptions(options)));
      break;
  }
};
