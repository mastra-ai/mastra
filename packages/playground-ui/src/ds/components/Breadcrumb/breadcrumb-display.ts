import { createContext, useContext } from 'react';

/**
 * How a trail lays out:
 * - `inline`: the default row of crumbs and separators.
 * - `current`: only the current crumb shows. The others stay in the DOM, hidden, so CSS can still
 *   tell whether the trail has parents (`:has(ol > li:nth-child(2))`).
 * - `stacked`: one crumb per row with no separators, for a menu listing the whole trail.
 *
 * Set by the container that hosts an already-built trail (e.g. the mobile header), so every
 * `Crumb` inside it, including app-specific crumb components, follows without new props.
 */
export type BreadcrumbDisplay = 'inline' | 'current' | 'stacked';

export const BreadcrumbDisplayContext = createContext<BreadcrumbDisplay>('inline');

export const useBreadcrumbDisplay = () => useContext(BreadcrumbDisplayContext);
