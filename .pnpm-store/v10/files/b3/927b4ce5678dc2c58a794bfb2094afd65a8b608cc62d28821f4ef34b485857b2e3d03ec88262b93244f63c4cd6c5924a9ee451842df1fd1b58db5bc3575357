import { Backend } from './backend.js';
import { InferenceSession } from './inference-session.js';
/**
 * Register a backend.
 *
 * @param name - the name as a key to lookup as an execution provider.
 * @param backend - the backend object.
 * @param priority - an integer indicating the priority of the backend. Higher number means higher priority. if priority
 * < 0, it will be considered as a 'beta' version and will not be used as a fallback backend by default.
 *
 * @ignore
 */
export declare const registerBackend: (name: string, backend: Backend, priority: number) => void;
/**
 * Resolve execution providers from the specific session options.
 *
 * @param options - the session options object.
 * @returns a promise that resolves to a tuple of an initialized backend instance and a session options object with
 * filtered EP list.
 *
 * @ignore
 */
export declare const resolveBackendAndExecutionProviders: (options: InferenceSession.SessionOptions) => Promise<[backend: Backend, options: InferenceSession.SessionOptions]>;
//# sourceMappingURL=backend-impl.d.ts.map