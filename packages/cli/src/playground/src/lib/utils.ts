import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string, hideError?: boolean) => {
  const res = await fetch(url);

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
