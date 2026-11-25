import type { ReactNode } from 'react';
import { FormFrame } from './form-frame';
import { PageFrame } from './page-frame';
import { SettingsFrame } from './settings-frame';
import type { LinkComponent } from '@/ds/types/link-component';

/** Lists, dashboards, detail pages and explorers: the full width, up to 1536px on very wide screens. */
export interface PageLayoutPageProps {
  variant: 'page';
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
   * - `fixed`: the body takes the remaining height edge to edge and never scrolls, so the panels,
   *   editor, graph, board or chat inside scroll on their own.
   */
  body?: 'scroll' | 'fixed';
  children: ReactNode;
}

/** A settings page someone browses to and changes in place: a centered 640px column of `SettingsGroup`s. */
export interface PageLayoutSettingsProps {
  variant: 'settings';
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
  /** `SettingsGroup`s, 24px apart. */
  children: ReactNode;
}

/**
 * A create or edit form (New alert, New project, Edit destination): a centered 640px column under the title,
 * with an optional back link above it. There is no breadcrumb bar, so a form shows one way back at most.
 */
export interface PageLayoutFormProps {
  variant: 'form';
  /** Where the back link goes. Shown with `backLabel`; leave both out when the app's navigation is the way out. */
  backHref?: string;
  /** The back link's text, such as the page it returns to. */
  backLabel?: string;
  title: ReactNode;
  /** Shows a skeleton in place of the title while the page loads. */
  isLoading?: boolean;
  /** The app's router link, so the back link navigates without a reload. It renders an `<a>` otherwise. */
  LinkComponent?: LinkComponent;
  /** A live preview beside the form when the column is wide enough, above the fields otherwise. */
  aside?: ReactNode;
  /** Sections (`SettingsGroup`s), 24px apart. */
  children: ReactNode;
}

export type PageLayoutProps = PageLayoutPageProps | PageLayoutSettingsProps | PageLayoutFormProps;

export type PageLayoutVariant = PageLayoutProps['variant'];

/**
 * The frame of every page: its width, gutter, scrolling and way back. Pick the `variant` that matches the page,
 * and each variant takes only the props that make sense for it.
 *
 * - `variant="form"`: a create or edit form. A title with an optional back link, no breadcrumbs, 640px column.
 * - `variant="settings"`: a settings page. Breadcrumbs and a title over a 640px column of `SettingsGroup`s.
 * - `variant="page"`: every other page (lists, dashboards, detail pages, explorers). Full width.
 *   Add `body="fixed"` when the body is panels that scroll on their own (chat, board, editor, graph).
 *
 * The frame is configured, not composed: what goes inside (`PageHeader`, `SettingsGroup`, `EmptyState`,
 * `DashboardGrid`, panels…) stays free.
 */
export function PageLayout(props: PageLayoutProps) {
  switch (props.variant) {
    case 'form': {
      const { variant: _variant, ...rest } = props;
      return <FormFrame {...rest} />;
    }
    case 'settings': {
      const { variant: _variant, ...rest } = props;
      return <SettingsFrame {...rest} />;
    }
    case 'page': {
      const { variant: _variant, ...rest } = props;
      return <PageFrame {...rest} />;
    }
  }
}
