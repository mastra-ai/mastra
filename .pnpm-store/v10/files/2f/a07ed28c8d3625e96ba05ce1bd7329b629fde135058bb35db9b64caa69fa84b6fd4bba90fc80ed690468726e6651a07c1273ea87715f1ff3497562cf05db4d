interface SafeTimers {
	nextTick?: (cb: () => void) => void;
	setImmediate?: {
		<TArgs extends any[]>(callback: (...args: TArgs) => void, ...args: TArgs): any;
		__promisify__: <T = void>(value?: T, options?: any) => Promise<T>;
	};
	clearImmediate?: (immediateId: any) => void;
	setTimeout: typeof setTimeout;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	clearTimeout: typeof clearTimeout;
	queueMicrotask: typeof queueMicrotask;
}
declare function getSafeTimers(): SafeTimers;
declare function setSafeTimers(): void;

export { getSafeTimers, setSafeTimers };
export type { SafeTimers };
