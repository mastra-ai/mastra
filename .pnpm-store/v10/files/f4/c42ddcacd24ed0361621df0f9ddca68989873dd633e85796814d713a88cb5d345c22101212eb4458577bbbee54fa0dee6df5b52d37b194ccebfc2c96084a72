import { customAlphabet } from "nanoid/non-secure";

export const generateId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7,
);

const optimisticPrefix = "__optimistic__";
export const generateOptimisticId = () => `${optimisticPrefix}${generateId()}`;
export const isOptimisticId = (id: string) => id.startsWith(optimisticPrefix);
