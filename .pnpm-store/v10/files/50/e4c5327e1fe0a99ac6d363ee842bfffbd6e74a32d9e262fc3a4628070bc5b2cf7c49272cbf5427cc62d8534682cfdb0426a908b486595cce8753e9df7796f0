import { Simplify } from "../helpers/types.js";

//#region src/components/Fetch.d.ts
declare const globalFetch: typeof globalThis.fetch;
type Fetch = typeof globalFetch;
type StepFetch = Fetch & Simplify<{
  config: (options: StepFetch.Options) => StepFetch;
} & Readonly<StepFetch.Options>>;
declare namespace StepFetch {
  interface Options {
    fallback?: Fetch | undefined;
  }
  interface Extras extends Options {
    config: (options: Options) => StepFetch;
  }
}
/**
 * `fetch` is a Fetch API-compatible function that can be used to make any HTTP
 * code durable if it's called within an Inngest function.
 *
 * It will gracefully fall back to the global `fetch` if called outside of this
 * context, and a custom fallback can be set using the `config` method.
 *
 * @example Basic usage
 * ```ts
 * import { fetch } from "inngest";
 *
 * const api = new MyProductApi({ fetch });
 * ```
 *
 * @example Setting a custom fallback
 * ```ts
 * import { fetch } from "inngest";
 *
 * const api = new MyProductApi({
 *            fetch: fetch.config({ fallback: myCustomFetch }),
 * });
 * ```
 *
 * @example Do not allow fallback
 * ```ts
 * import { fetch } from "inngest";
 *
 * const api = new MyProductApi({
 *            fetch: fetch.config({ fallback: undefined }),
 * });
 * ```
 */
declare const fetch: StepFetch;
//#endregion
export { StepFetch, fetch };
//# sourceMappingURL=Fetch.d.ts.map