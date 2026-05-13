import type { ComponentType, ReactNode, SVGProps } from 'react';

export type RouteHeaderIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface CrumbCtx {
  params: Readonly<Record<string, string | undefined>>;
  pathname: string;
}

export interface CrumbDef {
  /**
   * Static label or custom node. For hook-driven crumbs (e.g., showing a
   * fetched name), put the hook call inside a small React component and pass
   * the element here — it will render with its own React lifecycle.
   */
  node: ReactNode;
  to?: string;
  icon?: RouteHeaderIcon;
  /** Right-aligned action rendered inline with this crumb (e.g., a switcher chevron). */
  action?: ReactNode;
}

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
