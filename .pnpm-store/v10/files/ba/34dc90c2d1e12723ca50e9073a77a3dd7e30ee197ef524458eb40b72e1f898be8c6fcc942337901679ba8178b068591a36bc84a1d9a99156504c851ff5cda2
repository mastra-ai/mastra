export { h as handleValueOrFn } from '../handleValueOrFn-D2uLOn6s.js';

type Callback = (val?: any) => void;
/**
 * Create a promise that can be resolved or rejected from
 * outside the Promise constructor callback
 * A ES6 compatible utility that implements `Promise.withResolvers`
 * @internal
 */
declare const createDeferredPromise: () => {
    promise: Promise<unknown>;
    resolve: Callback;
    reject: Callback;
};

/**
 * A ES6 compatible utility that implements `Promise.allSettled`
 * @internal
 */
declare function allSettled<T>(iterable: Iterable<Promise<T>>): Promise<({
    status: 'fulfilled';
    value: T;
} | {
    status: 'rejected';
    reason: any;
})[]>;

/**
 * Check if the frontendApi ends with a staging domain
 */
declare function isStaging(frontendApi: string): boolean;

declare const logErrorInDevMode: (message: string) => void;

declare const noop: (..._args: any[]) => void;

declare const isDevelopmentEnvironment: () => boolean;
declare const isTestEnvironment: () => boolean;
declare const isProductionEnvironment: () => boolean;

/**
 * Merges 2 objects without creating new object references
 * The merged props will appear on the `target` object
 * If `target` already has a value for a given key it will not be overwritten
 */
declare const fastDeepMergeAndReplace: (source: Record<any, any> | undefined | null, target: Record<any, any> | undefined | null) => void;
declare const fastDeepMergeAndKeep: (source: Record<any, any> | undefined | null, target: Record<any, any> | undefined | null) => void;

export { allSettled, createDeferredPromise, fastDeepMergeAndKeep, fastDeepMergeAndReplace, isDevelopmentEnvironment, isProductionEnvironment, isStaging, isTestEnvironment, logErrorInDevMode, noop };
