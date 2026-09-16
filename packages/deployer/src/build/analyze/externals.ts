import { DEPRECATED_EXTERNALS, GLOBAL_EXTERNALS } from './constants';

export interface NormalizedExternals {
  externalsPreset: boolean;
  mergedExternals: string[];
}

export function normalizeExternals(
  externals?: boolean | string[] | null,
  userExternals?: string[],
): NormalizedExternals {
  const explicitExternals = Array.isArray(externals) ? externals : [];

  return {
    externalsPreset: externals === true,
    mergedExternals: [
      ...new Set(
        [
          ...GLOBAL_EXTERNALS,
          ...DEPRECATED_EXTERNALS,
          ...explicitExternals,
          // When externals is the boolean preset and userExternals carries the
          // original explicit entries (preserved by BuildBundler), merge them
          // so workspace packages the caller asked to externalize stay external.
          ...(externals === true && userExternals ? userExternals : []),
        ].filter(Boolean),
      ),
    ],
  };
}
