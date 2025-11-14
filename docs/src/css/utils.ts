import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const mergeClasses =
  (clsx: any, twMerge: any) =>
  (...inputs: ClassValue[]) => {
    return twMerge(clsx(inputs));
  };

export const cn = mergeClasses(clsx, twMerge);
