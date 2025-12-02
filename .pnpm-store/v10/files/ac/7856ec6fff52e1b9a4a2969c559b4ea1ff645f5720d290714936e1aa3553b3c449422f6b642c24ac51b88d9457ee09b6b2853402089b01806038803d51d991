export type Options = {
	/**
	Time in milliseconds to wait until the `input` function is called.

	@default 0
	*/
	readonly wait?: number;

	/**
	The maximum time the `input` function is allowed to be delayed before it's invoked.

	This can be used to control the rate of calls handled in a constant stream. For example, a media player sending updates every few milliseconds but wants to be handled only once a second.

	@default Infinity
	*/
	readonly maxWait?: number;

	/**
	Trigger the function on the leading edge of the `wait` interval.

	For example, this can be useful for preventing accidental double-clicks on a "submit" button from firing a second time.

	@default false
	*/
	readonly before?: boolean;

	/**
	Trigger the function on the trailing edge of the `wait` interval.

	@default true
	*/
	readonly after?: boolean;
};

export type BeforeOptions = {
	readonly before: true;
} & Options;

export type NoBeforeNoAfterOptions = {
	readonly after: false;
	readonly before?: false;
} & Options;

export type DebouncedFunction<ArgumentsType extends unknown[], ReturnType> = {
	(...arguments: ArgumentsType): ReturnType;
	cancel(): void;
};

/**
[Debounce](https://davidwalsh.name/javascript-debounce-function) a function.

@param input - Function to debounce.
@returns A debounced function that delays calling the `input` function until after `wait` milliseconds have elapsed since the last time the debounced function was called.

It comes with a `.cancel()` method to cancel any scheduled `input` function calls.

@example
```
import debounceFn from 'debounce-fn';

window.onresize = debounceFn(() => {
	// Do something on window resize
}, {wait: 100});
```
*/
export default function debounceFn<ArgumentsType extends unknown[], ReturnType>(
	input: (...arguments: ArgumentsType) => ReturnType,
	options: BeforeOptions
): DebouncedFunction<ArgumentsType, ReturnType>;

export default function debounceFn<ArgumentsType extends unknown[], ReturnType>(
	input: (...arguments: ArgumentsType) => ReturnType,
	options: NoBeforeNoAfterOptions
): DebouncedFunction<ArgumentsType, undefined>;

export default function debounceFn<ArgumentsType extends unknown[], ReturnType>(
	input: (...arguments: ArgumentsType) => ReturnType,
	options?: Options
): DebouncedFunction<ArgumentsType, ReturnType | undefined>;
