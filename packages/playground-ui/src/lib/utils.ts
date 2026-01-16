import { clsx, type ClassValue } from 'clsx';
import { twMerge } from './tw-merge-config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
