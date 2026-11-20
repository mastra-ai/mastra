import type { ReactNode } from 'react';
import { FormFrame } from './form-frame';
import { PageFrame } from './page-frame';
import { SettingsFrame } from './settings-frame';
import type { LinkComponent } from '@/ds/types/link-component';

/** Lists, dashboards, detail pages and explorers: the full width, up to 1536px on very wide screens. */
export interface PageLayoutPageProps {
  kind: 'page';
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Controls pinned between the header and the scrollable body (search, filters, toggles…). */
  actionRow?: ReactNode;
  /** Page-level header (e.g. `PageHeader`) rendered inside the body container, above children. */
  header?: ReactNode;
  /**
   * How the body fills the page.
   * - `scroll` (default): the page scrolls as one.
   * - `workspace`: the body takes the remaining height edge to edge and never scrolls, so the panels,
   *   editor, graph, board or chat inside scroll on their own.
   */
  body?: 'scroll' | 'workspace';
  children: ReactNode;
}

/** A settings page someone browses to and changes in place: a centered 640px column of `SettingsGroup`s. */
export interface PageLayoutSettingsProps {
  kind: 'settings';
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** The page title. Leave it out when the app's own header already names the page. */
  title?: ReactNode;
  /** Shown beside the title (a status badge, a count…). */
  titleAccessory?: ReactNode;
  /** Shown at the end of the title row. */
  action?: ReactNode;
  /** A header of the app's own in place of `title` (a `PageHeader` whose title takes focus), with the same inset. */
  header?: ReactNode;
  /** `SettingsGroup`s, 28px apart. */
  children: ReactNode;
}

/**
 * A create or edit form (New alert, New project, Edit destination): a centered 640px column under a back link
 * and the title. There is no breadcrumb bar: the back link is the way out, so a form shows one way back, not two.
 */
export interface PageLayoutFormProps {
  kind: 'form';
  backHref: string;
  backLabel: string;
  title: ReactNode;
  /** Shows a skeleton in place of the title while the page loads. */
  isLoading?: boolean;
  /** The app's router link, so the back link navigates without a reload. It renders an `<a>` otherwise. */
  LinkComponent?: LinkComponent;
  /** A live preview beside the form when the column is wide enough, above the fields otherwise. */
  aside?: ReactNode;
  /** Sections (`SettingsGroup`s), 28px apart. */
  children: ReactNode;
}

export type PageLayoutProps = PageLayoutPageProps | PageLayoutSettingsProps | PageLayoutFormProps;

export type PageLayoutKind = PageLayoutProps['kind'];

/**
 * The frame of every page: its width, gutter, scrolling and way back. Pick the `kind` that matches the page,
 * and each kind takes only the props that make sense for it.
 *
 * - `kind="form"`: a create or edit form. Back link and title, no breadcrumbs, 640px column.
 * - `kind="settings"`: a settings page. Breadcrumbs and a title over a 640px column of `SettingsGroup`s.
 * - `kind="page"`: every other page (lists, dashboards, detail pages, explorers). Full width.
 *   Add `body="workspace"` when the body is panels that scroll on their own (chat, board, editor, graph).
 *
 * The frame is configured, not composed: what goes inside (`PageHeader`, `SettingsGroup`, `EmptyState`,
 * `DashboardGrid`, panels…) stays free.
 */
export function PageLayout(props: PageLayoutProps) {
  switch (props.kind) {
    case 'form': {
      const { kind: _kind, ...rest } = props;
      return <FormFrame {...rest} />;
    }
    case 'settings': {
      const { kind: _kind, ...rest } = props;
      return <SettingsFrame {...rest} />;
    }
    case 'page': {
      const { kind: _kind, ...rest } = props;
      return <PageFrame {...rest} />;
    }
  }
}
