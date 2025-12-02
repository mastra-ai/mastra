export class InvariantError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, InvariantError.prototype);
    }
}
/**
 * Provide a condition and if that condition is falsey, this throws an error
 * with the given message.
 *
 * inspired by invariant from 'tiny-invariant' except will still include the
 * message in production.
 *
 * @example
 * invariant(typeof value === 'string', `value must be a string`)
 *
 * @param condition The condition to check
 * @param message The message to throw (or a callback to generate the message)
 * @param responseInit Additional response init options if a response is thrown
 *
 * @throws {InvariantError} if condition is falsey
 */
export function invariant(condition, message) {
    if (!condition) {
        throw new InvariantError(typeof message === 'function' ? message() : message);
    }
}
/**
 * Provide a condition and if that condition is falsey, this throws a 400
 * Response with the given message.
 *
 * inspired by invariant from 'tiny-invariant'
 *
 * @example
 * invariantResponse(typeof value === 'string', `value must be a string`)
 *
 * @param condition The condition to check
 * @param message The message to throw (or a callback to generate the message)
 * @param responseInit Additional response init options if a response is thrown
 *
 * @throws {Response} if condition is falsey
 */
export function invariantResponse(condition, message, responseInit) {
    if (!condition) {
        throw new Response(typeof message === 'function' ? message() : message, {
            status: 400,
            ...responseInit,
        });
    }
}
