// src/utils/idUtils.tsx
import { customAlphabet } from "nanoid/non-secure";
var generateId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7
);
var optimisticPrefix = "__optimistic__";
var generateOptimisticId = () => `${optimisticPrefix}${generateId()}`;
var isOptimisticId = (id) => id.startsWith(optimisticPrefix);
export {
  generateId,
  generateOptimisticId,
  isOptimisticId
};
//# sourceMappingURL=idUtils.js.map