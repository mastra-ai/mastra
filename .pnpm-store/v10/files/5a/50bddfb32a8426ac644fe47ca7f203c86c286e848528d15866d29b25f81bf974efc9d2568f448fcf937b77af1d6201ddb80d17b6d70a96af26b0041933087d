import type {IsNever} from '../is-never.d.ts';
import type {Finite, NegativeInfinity, PositiveInfinity} from '../numeric.d.ts';
import type {UnknownArray} from '../unknown-array.d.ts';
import type {StringToNumber} from './string.d.ts';
import type {IsAnyOrNever} from './type.d.ts';

/**
Returns the absolute value of a given value.

@example
```
NumberAbsolute<-1>;
//=> 1

NumberAbsolute<1>;
//=> 1

NumberAbsolute<NegativeInfinity>
//=> PositiveInfinity
```
*/
export type NumberAbsolute<N extends number> = `${N}` extends `-${infer StringPositiveN}` ? StringToNumber<StringPositiveN> : N;

/**
Check whether the given type is a number or a number string.

Supports floating-point as a string.

@example
```
type A = IsNumberLike<'1'>;
//=> true

type B = IsNumberLike<'-1.1'>;
//=> true

type C = IsNumberLike<'5e-20'>;
//=> true

type D = IsNumberLike<1>;
//=> true

type E = IsNumberLike<'a'>;
//=> false
*/
export type IsNumberLike<N> =
	IsAnyOrNever<N> extends true ? N
		: N extends number | `${number}`
			? true
			: false;

/**
Returns the minimum number in the given union of numbers.

Note: Just supports numbers from 0 to 999.

@example
```
type A = UnionMin<1 | 3 | 2>;
//=> 1

type B = UnionMin<number>;
//=> number

type C = UnionMin<any>;
//=> any

type D = UnionMin<never>;
//=> never
```
*/
export type UnionMin<N extends number> =
	IsAnyOrNever<N> extends true ? N
		: number extends N ? number
			: NegativeInfinity extends N ? NegativeInfinity
				: [N] extends [PositiveInfinity] ? PositiveInfinity
					: InternalUnionMin<Finite<N>>;

/**
The actual implementation of `UnionMin`. It's private because it has some arguments that don't need to be exposed.
*/
type InternalUnionMin<N extends number, T extends UnknownArray = []> =
	T['length'] extends N
		? T['length']
		: InternalUnionMin<N, [...T, unknown]>;

/**
Returns the maximum number in the given union of numbers.

Note: Just supports numbers from 0 to 999.

@example
```
type A = UnionMax<1 | 3 | 2>;
//=> 3

type B = UnionMax<number>;
//=> number

type C = UnionMax<any>;
//=> any

type D = UnionMax<never>;
//=> never
```
*/
export type UnionMax<N extends number> =
	IsAnyOrNever<N> extends true ? N
		: number extends N ? number
			: PositiveInfinity extends N ? PositiveInfinity
				: [N] extends [NegativeInfinity] ? NegativeInfinity
					: InternalUnionMax<Finite<N>>;

/**
The actual implementation of `UnionMax`. It's private because it has some arguments that don't need to be exposed.
*/
type InternalUnionMax<N extends number, T extends UnknownArray = []> =
	IsNever<N> extends true
		? T['length']
		: T['length'] extends N
			? InternalUnionMax<Exclude<N, T['length']>, T>
			: InternalUnionMax<N, [...T, unknown]>;

/**
Returns the number with reversed sign.

@example
```
ReverseSign<-1>;
//=> 1

ReverseSign<1>;
//=> -1

ReverseSign<NegativeInfinity>
//=> PositiveInfinity

ReverseSign<PositiveInfinity>
//=> NegativeInfinity
```
*/
export type ReverseSign<N extends number> =
	// Handle edge cases
	N extends 0 ? 0 : N extends PositiveInfinity ? NegativeInfinity : N extends NegativeInfinity ? PositiveInfinity :
	// Handle negative numbers
	`${N}` extends `-${infer P extends number}` ? P
		// Handle positive numbers
		: `-${N}` extends `${infer R extends number}` ? R : never;

export {};
