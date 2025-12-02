/**
 * Obliterator Filter Function
 * ===========================
 *
 * Function returning a iterator filtering the given iterator.
 */
var Iterator = require('./iterator.js');

/**
 * Filter.
 *
 * @param  {function} predicate - Predicate function.
 * @param  {Iterator} target - Target iterator.
 * @return {Iterator}
 */
module.exports = function filter(predicate, target) {
  return new Iterator(function next() {
    var step = target.next();

    if (step.done)
      return step;

    if (!predicate(step.value))
      return next();

    return step;
  });
};
