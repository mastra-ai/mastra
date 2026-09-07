import type { estimateTokenCount as EstimateTokenCount, sliceByTokens as SliceByTokens } from 'tokenx';

type TokenxApi = {
  estimateTokenCount: typeof EstimateTokenCount;
  sliceByTokens: typeof SliceByTokens;
};

let cached: TokenxApi | undefined;
let loading: Promise<TokenxApi> | undefined;

// Keep the specifier as a parameter so tsdown cannot fold it into a literal dynamic import.
const importModule = (moduleName: string) => import(/* @vite-ignore */ /* webpackIgnore: true */ moduleName);

/**
 * Lazily imports tokenx using a runtime-constructed module specifier.
 * tokenx is ESM-only. A static import becomes a CommonJS require of that
 * package, which Jest's default runtime cannot load.
 */
export async function getTokenx(): Promise<TokenxApi> {
  if (cached) {
    return cached;
  }
  if (!loading) {
    loading = (async () => {
      try {
        const loaded = (await importModule('tokenx')) as TokenxApi;
        cached = {
          estimateTokenCount: loaded.estimateTokenCount,
          sliceByTokens: loaded.sliceByTokens,
        };
        return cached;
      } catch (err) {
        throw new Error('tokenx is required for token estimation but could not be loaded in this environment.', {
          cause: err,
        });
      }
    })();
  }
  return loading;
}

export async function estimateTokenCount(text?: string): Promise<number> {
  return (await getTokenx()).estimateTokenCount(text);
}

export async function sliceByTokens(text: string, start?: number, end?: number): Promise<string> {
  return (await getTokenx()).sliceByTokens(text, start, end);
}
