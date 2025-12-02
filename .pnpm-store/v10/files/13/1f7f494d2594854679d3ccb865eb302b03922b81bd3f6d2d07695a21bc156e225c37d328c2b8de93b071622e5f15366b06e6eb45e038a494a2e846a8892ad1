/**
 * Obliterator Iterator Class
 * ===========================
 *
 * Simple class representing the library's iterators.
 */

/**
 * Iterator class.
 *
 * @constructor
 * @param {function} next - Next function.
 */
function Iterator(next) {

  // Hiding the given function
  Object.defineProperty(this, '_next', {
    writable: false,
    enumerable: false,
    value: next
  });

  // Is the iterator complete?
  this.done = false;
}

/**
 * Next function.
 *
 * @return {object}
 */
// NOTE: maybe this should dropped for performance?
Iterator.prototype.next = function() {
  if (this.done)
    return {done: true};

  var step = this._next();

  if (step.done)
    this.done = true;

  return step;
};

/**
 * If symbols are supported, we add `next` to `Symbol.iterator`.
 */
if (typeof Symbol !== 'undefined')
  Iterator.prototype[Symbol.iterator] = function() {
    return this;
  };

/**
 * Returning an iterator of the given values.
 *
 * @param  {any...} values - Values.
 * @return {Iterator}
 */
Iterator.of = function() {
  var args = arguments,
      l = args.length,
      i = 0;

  return new Iterator(function() {
    if (i >= l)
      return {done: true};

    return {done: false, value: args[i++]};
  });
};

/**
 * Returning an empty iterator.
 *
 * @return {Iterator}
 */
Iterator.empty = function() {
  var iterator = new Iterator(null);
  iterator.done = true;

  return iterator;
};

/**
 * Returning whether the given value is an iterator.
 *
 * @param  {any} value - Value.
 * @return {boolean}
 */
Iterator.is = function(value) {
  if (value instanceof Iterator)
    return true;

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.next === 'function'
  );
};

/**
 * Exporting.
 */
module.exports = Iterator;
