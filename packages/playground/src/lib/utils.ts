import prettier from 'prettier';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string, hideError?: boolean) => {
  const res = await fetch(url, {
    headers: {
      'x-mastra-dev-playground': 'true',
    },
  });

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.') as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    if (!hideError) {
      toast.error((error?.info as any)?.error || error?.message);
    }

    throw error;
  }

  return res.json();
};

export const formatJSON = async (code: string) => {
  const formatted = await prettier.format(code, {
    semi: false,
    parser: 'json',
    printWidth: 80,
    tabWidth: 2,
    plugins: [prettierPluginBabel, prettierPluginEstree],
  });

  return formatted;
};

export const isValidJson = (str: string) => {
  try {
    // Attempt to parse the string as JSON
    const obj = JSON.parse(str);

    // Additionally check if the parsed result is an object
    return !!obj && typeof obj === 'object';
  } catch (e) {
    // If parsing throws an error, it's not valid JSON
    return false;
  }
};
