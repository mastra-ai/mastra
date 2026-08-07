import * as React from 'react';

/**
 * Transitional shim for the legacy Radix-style `asChild` boolean on our Base UI
 * wrappers.
 *
 * Base UI's native composition API is the `render` prop (`render={<Button />}`):
 * it is better typed (accepts an element OR a `(props, state) => element`
 * function, and pairs with `nativeButton` for non-`<button>` elements) and is
 * the idiom this design system is moving to. Because our trigger props already
 * extend the Base UI primitive props, `render` works today with no shim.
 *
 * This helper keeps `asChild` working by translating it into `render`, so the
 * single deprecated code path lives in one place instead of being copy-pasted
 * across every trigger/close wrapper.
 *
 * @returns `{ render }` when `asChild` should compose its child, otherwise
 * `undefined` (safe to spread as a no-op).
 * @deprecated Pass Base UI's `render` prop directly; `asChild` will be removed.
 */
export function asChildRenderProps(
  asChild: boolean | undefined,
  children: React.ReactNode,
): { render: React.ReactElement } | undefined {
  return asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : undefined;
}
