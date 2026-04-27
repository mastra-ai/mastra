import type { execa as execaType } from 'execa';

let cached: typeof execaType | undefined;
let loading: Promise<typeof execaType> | undefined;

/**
 * Lazily imports execa using a runtime-constructed module specifier.
 * This prevents bundlers (Vite/Rollup/esbuild) from resolving execa at build time,
 * which is necessary for Cloudflare Workers where execa's transitive deps
 * (npm-run-path → unicorn-magic) use Node-only conditional exports.
 */
export async function getExeca(): Promise<typeof execaType> {
  if (cached) {
    return cached;
  }
  if (!loading) {
    loading = (async () => {
      try {
        const mod = 'execa';
        const execa = (await import(/* @vite-ignore */ /* webpackIgnore: true */ mod)).execa;
        cached = execa;
        return execa;
      } catch (err) {
        throw new Error(
          'execa is required for local process execution but is not available in this environment. ' +
            'LocalProcessManager is not supported in Cloudflare Workers or other non-Node runtimes.',
          { cause: err },
        );
      }
    })();
  }
  return loading;
}
