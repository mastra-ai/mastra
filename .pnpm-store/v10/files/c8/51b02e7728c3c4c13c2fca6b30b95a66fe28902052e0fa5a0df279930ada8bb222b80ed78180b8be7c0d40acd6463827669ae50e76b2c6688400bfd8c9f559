import mimicFunction from 'mimic-function';

const debounceFunction = (inputFunction, options = {}) => {
	if (typeof inputFunction !== 'function') {
		throw new TypeError(`Expected the first argument to be a function, got \`${typeof inputFunction}\``);
	}

	const {
		wait = 0,
		maxWait = Number.POSITIVE_INFINITY,
		before = false,
		after = true,
	} = options;

	if (wait < 0 || maxWait < 0) {
		throw new RangeError('`wait` and `maxWait` must not be negative.');
	}

	if (!before && !after) {
		throw new Error('Both `before` and `after` are false, function wouldn\'t be called.');
	}

	let timeout;
	let maxTimeout;
	let result;

	const debouncedFunction = function (...arguments_) {
		const context = this; // eslint-disable-line unicorn/no-this-assignment

		const later = () => {
			timeout = undefined;

			if (maxTimeout) {
				clearTimeout(maxTimeout);
				maxTimeout = undefined;
			}

			if (after) {
				result = inputFunction.apply(context, arguments_);
			}
		};

		const maxLater = () => {
			maxTimeout = undefined;

			if (timeout) {
				clearTimeout(timeout);
				timeout = undefined;
			}

			if (after) {
				result = inputFunction.apply(context, arguments_);
			}
		};

		const shouldCallNow = before && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);

		if (maxWait > 0 && maxWait !== Number.POSITIVE_INFINITY && !maxTimeout) {
			maxTimeout = setTimeout(maxLater, maxWait);
		}

		if (shouldCallNow) {
			result = inputFunction.apply(context, arguments_);
		}

		return result;
	};

	mimicFunction(debouncedFunction, inputFunction);

	debouncedFunction.cancel = () => {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}

		if (maxTimeout) {
			clearTimeout(maxTimeout);
			maxTimeout = undefined;
		}
	};

	return debouncedFunction;
};

export default debounceFunction;
