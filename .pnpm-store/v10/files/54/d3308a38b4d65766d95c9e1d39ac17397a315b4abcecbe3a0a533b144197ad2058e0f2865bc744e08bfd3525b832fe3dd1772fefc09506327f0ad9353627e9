"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unreachable = void 0;
/**
 * Indicates that code is unreachable.
 *
 * This can be used for exhaustiveness checks in situations where the compiler
 * would not otherwise check for exhaustiveness.
 *
 * If the determination that the code is unreachable proves incorrect, an
 * exception is thrown.
 */
const unreachable = (condition, 
// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
message = `Entered unreachable code. Received '${condition}'.`) => {
    throw new TypeError(message);
};
exports.unreachable = unreachable;
