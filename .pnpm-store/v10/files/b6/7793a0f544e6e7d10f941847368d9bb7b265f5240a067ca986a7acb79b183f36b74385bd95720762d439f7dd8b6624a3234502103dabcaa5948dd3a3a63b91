import {type Writable} from 'node:stream';

export type SpinnerStyle = {
	readonly interval?: number;
	readonly frames: string[];
};

export type Color =
	| 'black'
	| 'red'
	| 'green'
	| 'yellow'
	| 'blue'
	| 'magenta'
	| 'cyan'
	| 'white'
	| 'gray';

export type Options = {
	/**
	Text to display next to the spinner.

	@default ''
	*/
	readonly text?: string;

	/**
	Customize the spinner animation with a custom set of frames and interval.

	```
	{
		frames: ['-', '\\', '|', '/'],
		interval: 100,
	}
	```

	Pass in any spinner from [`cli-spinners`](https://github.com/sindresorhus/cli-spinners).
	*/
	readonly spinner?: SpinnerStyle;

	/**
	The color of the spinner.

	@default 'cyan'
	*/
	readonly color?: Color;

	/**
	The stream to which the spinner is written.

	@default process.stderr
	*/
	readonly stream?: Writable;
};

export type Spinner = {
	/**
	Change the text displayed next to the spinner.

	@example
	```
	spinner.text = 'New text';
	```
	*/
	text: string;

	/**
	Change the spinner color.
	*/
	color: Color;

	/**
	Starts the spinner.

	Optionally, updates the text.

	@param text - The text to display next to the spinner.
	@returns The spinner instance.
	*/
	start(text?: string): Spinner;

	/**
	Stops the spinner.

	Optionally displays a final message.

	@param finalText - The final text to display after stopping the spinner.
	@returns The spinner instance.
	*/
	stop(finalText?: string): Spinner;

	/**
	Stops the spinner and displays a success symbol with the message.

	@param text - The success message to display.
	@returns The spinner instance.
	*/
	success(text?: string): Spinner;

	/**
	Stops the spinner and displays an error symbol with the message.

	@param text - The error message to display.
	@returns The spinner instance.
	*/
	error(text?: string): Spinner;

	/**
	Stops the spinner and displays a warning symbol with the message.

	@param text - The warning message to display.
	@returns The spinner instance.
	*/
	warning(text?: string): Spinner;

	/**
	Stops the spinner and displays an info symbol with the message.

	@param text - The info message to display.
	@returns The spinner instance.
	*/
	info(text?: string): Spinner;

	/**
	Clears the spinner.

	@returns The spinner instance.
	*/
	clear(): Spinner;

	/**
	Returns whether the spinner is currently spinning.
	*/
	get isSpinning(): boolean;
};

/**
Creates a new spinner instance.

@returns A new spinner instance.

@example
```
import yoctoSpinner from 'yocto-spinner';

const spinner = yoctoSpinner({text: 'Loading…'}).start();

setTimeout(() => {
	spinner.success('Success!');
}, 2000);
```
*/
export default function yoctoSpinner(options?: Options): Spinner;
