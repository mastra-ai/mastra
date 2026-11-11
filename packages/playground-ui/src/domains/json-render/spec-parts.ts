import type { Spec } from '@json-render/core';
import { buildSpecFromParts } from '@json-render/react';
import { studioCatalog } from '@mastra/json-render/studio';

/** A `data-spec` part, as `JsonRenderProcessor` streams and saves them. */
export interface SpecPart {
  type: 'data-spec';
  data?: unknown;
}

export const isSpecPart = <P extends { type: string }>(part: P): part is P & SpecPart => part.type === 'data-spec';

const studioComponents = new Set<string>(studioCatalog.componentNames);

/**
 * The interface a message's `data-spec` parts build, or `null` until a patch sets its root, when a
 * patch cannot be applied, or when it uses components outside `studioCatalog` (an agent built on its own catalog).
 * json-render 0.22 writes patch values into the spec by reference, so building twice from the
 * same parts would grow their lists; it builds from a copy instead.
 */
export const buildInterfaceSpec = (parts: SpecPart[]): Spec | null => {
  if (parts.length === 0) return null;
  let spec: Spec | null;
  try {
    spec = buildSpecFromParts(structuredClone(parts));
  } catch {
    // A patch that cannot be applied (a failing `test` op, a malformed path) leaves no interface to show.
    return null;
  }
  if (!spec?.root) return null;
  return Object.values(spec.elements).every(element => studioComponents.has(element.type)) ? spec : null;
};
