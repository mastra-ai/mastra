"use strict";
export function validateArg(arg, idx, method, argName) {
  if (arg === void 0) {
    throw new TypeError(
      `Must provide arg ${idx} \`${argName}\` to \`${method}\``
    );
  }
}
export function validateArgIsInteger(arg, idx, method, argName) {
  if (!Number.isInteger(arg)) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be an integer`
    );
  }
}
export function validateArgIsNonNegativeInteger(arg, idx, method, argName) {
  if (!Number.isInteger(arg) || arg < 0) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be a non-negative integer`
    );
  }
}
//# sourceMappingURL=validate.js.map
