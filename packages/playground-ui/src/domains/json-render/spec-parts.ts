import type { Spec } from '@json-render/core';
import { buildSpecFromParts } from '@json-render/react';

/** A `data-spec` part, as `JsonRenderProcessor` streams and saves them. */
export interface SpecPart {
  type: 'data-spec';
  data?: unknown;
}

export const isSpecPart = <P extends { type: string }>(part: P): part is P & SpecPart => part.type === 'data-spec';

/**
 * The interface a message's `data-spec` parts build, or `null` until a patch sets its root.
 * json-render 0.22 writes patch values into the spec by reference, so building twice from the
 * same parts would grow their lists; it builds from a copy instead.
 */
export const buildInterfaceSpec = (parts: SpecPart[]): Spec | null => {
  if (parts.length === 0) return null;
  const spec = buildSpecFromParts(structuredClone(parts));
  return spec?.root ? spec : null;
};
