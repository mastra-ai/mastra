declare const deprecated: (fnName: string, warning: string, key?: string) => void;
/**
 * Mark class property as deprecated.
 *
 * A console WARNING will be displayed when class property is being accessed.
 *
 * 1. Deprecate class property
 * class Example {
 *   something: string;
 *   constructor(something: string) {
 *     this.something = something;
 *   }
 * }
 *
 * deprecatedProperty(Example, 'something', 'Use `somethingElse` instead.');
 *
 * 2. Deprecate class static property
 * class Example {
 *   static something: string;
 * }
 *
 * deprecatedProperty(Example, 'something', 'Use `somethingElse` instead.', true);
 */
type AnyClass = new (...args: any[]) => any;
declare const deprecatedProperty: (cls: AnyClass, propName: string, warning: string, isStatic?: boolean) => void;
/**
 * Mark object property as deprecated.
 *
 * A console WARNING will be displayed when object property is being accessed.
 *
 * 1. Deprecate object property
 * const obj = { something: 'aloha' };
 *
 * deprecatedObjectProperty(obj, 'something', 'Use `somethingElse` instead.');
 */
declare const deprecatedObjectProperty: (obj: Record<string, any>, propName: string, warning: string, key?: string) => void;

export { deprecated, deprecatedObjectProperty, deprecatedProperty };
