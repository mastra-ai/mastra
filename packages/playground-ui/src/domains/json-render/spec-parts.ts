import type { Spec } from '@json-render/core';
import { buildSpecFromParts } from '@json-render/react';
import { studioCatalog } from '@mastra/json-render/studio';

/** A `data-spec` part, as `JsonRenderProcessor` streams and saves them. */
export interface SpecPart {
  type: 'data-spec';
  data?: unknown;
}

export const isSpecPart = <P extends { type: string }>(part: P): part is P & SpecPart => part.type === 'data-spec';

/** The props each `studioCatalog` component declares. */
const studioProps = new Map(
  Object.entries(studioCatalog.data.components).map(([name, { props }]) => [name, new Set(Object.keys(props.shape))]),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether every element is a `studioCatalog` component with only the props it declares, and the tree has no cycle.
 * A spec does not say which catalog it was written for, so a component of the same name with other props is
 * taken as another catalog's; and an element that contains itself would render forever.
 */
const isStudioTree = (spec: Spec) => {
  const elements: unknown = spec.elements;
  if (!isRecord(elements)) return false;
  for (const element of Object.values(elements)) {
    if (!isRecord(element) || typeof element.type !== 'string') return false;
    const props = studioProps.get(element.type);
    if (!props || !Object.keys(element.props ?? {}).every(prop => props.has(prop))) return false;
    if (element.children !== undefined && !Array.isArray(element.children)) return false;
  }
  const inside = new Set<string>();
  const acyclic = (key: string): boolean => {
    if (inside.has(key)) return false;
    inside.add(key);
    const children = (elements[key] as { children?: string[] } | undefined)?.children ?? [];
    const ok = children.every(acyclic);
    inside.delete(key);
    return ok;
  };
  return acyclic(spec.root);
};

/**
 * The interface a message's `data-spec` parts build, or `null` until a patch sets its root, when a
 * patch cannot be applied, or when it is not a tree of `studioCatalog` components (see `isStudioTree`).
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
  return spec?.root && isStudioTree(spec) ? spec : null;
};
