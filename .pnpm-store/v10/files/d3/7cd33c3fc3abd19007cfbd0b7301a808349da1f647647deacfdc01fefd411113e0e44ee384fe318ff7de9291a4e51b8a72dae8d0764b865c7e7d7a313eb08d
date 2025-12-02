/**
 * Obliterator Map Function
 * ===========================
 *
 * Function returning a iterator mapping the given iterator's values.
 */
var Iterator = require('./iterator.js');

/**
 * Map.
 *
 * @param  {function} mapper - Map function.
 * @param  {Iterator} target - Target iterator.
 * @return {Iterator}
 */
module.exports = function map(mapper, target) {
  return new Iterator(function next() {
    var step = target.next();

    if (step.done)
      return step;

    return {
      value: mapper(step.value)
    };
  });
};
