import type { UIMatch } from 'react-router';

/** Route metadata declares the feature without coupling the frame to URL patterns. */
export function featureNavigationLabel(matches: UIMatch[]): string | undefined {
  for (const { handle } of [...matches].reverse()) {
    if (typeof handle !== 'object' || handle === null || !('navigationLabel' in handle)) continue;
    if (typeof handle.navigationLabel === 'string') return handle.navigationLabel;
  }
  return undefined;
}
