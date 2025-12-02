import { auto } from './auto.mjs';
import { number } from './numbers/index.mjs';
import { px, percent, degrees, vw, vh } from './numbers/units.mjs';
import { testValueType } from './test.mjs';

/**
 * A list of value types commonly used for dimensions
 */
const dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
/**
 * Tests a dimensional value against the list of dimension ValueTypes
 */
const findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

export { dimensionValueTypes, findDimensionValueType };
