import type { ComponentType, ReactNode, SVGProps } from 'react';

export type RouteHeaderIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface CrumbCtx {
  params: Readonly<Record<string, string | undefined>>;
  pathname: string;
}

interface CrumbBase {
  /**
   * Stable route-local identifier used as the React key and as reviewable
   * route metadata. Prefer semantic ids like `agent`, `dataset-item`, or
   * `schedules` over labels that may change.
   */
  id: string;
  /** Accessible page heading fallback when the visual crumb content is custom. */
  heading?: string;
  to?: string;
  icon?: RouteHeaderIcon;
}

export type CrumbDef = CrumbBase &
  (
    | {
        label: string;
        node?: never;
        Component?: never;
      }
    | {
        /**
         * Custom node for a crumb. Use sparingly; prefer `label` for static
         * text and `Component` for hook-driven dynamic crumbs.
         */
        node: ReactNode;
        label?: never;
        Component?: never;
      }
    | {
        /**
         * Hook-driven crumbs (for fetched names, comboboxes, etc.) should live
         * in small domain components so the route config stays declarative.
         */
        Component: ComponentType;
        label?: never;
        node?: never;
      }
  );

export interface DocsLink {
  href: string;
  label?: string;
}

export type CrumbsResolver = CrumbDef[] | ((ctx: CrumbCtx) => CrumbDef[]);
export type DocsResolver = DocsLink | ((ctx: CrumbCtx) => DocsLink | undefined);

export interface RouteHeaderHandle {
  /**
   * Crumbs contributed by this route. Concatenated in match order so parents
   * provide ancestor crumbs and children provide leaves. Functions receive the
   * match's params/pathname so dynamic crumbs can pull from URL params.
   */
  crumbs?: CrumbsResolver;
  /** Docs link rendered on the right of the bar. Deepest match wins. */
  docs?: DocsResolver;
}
