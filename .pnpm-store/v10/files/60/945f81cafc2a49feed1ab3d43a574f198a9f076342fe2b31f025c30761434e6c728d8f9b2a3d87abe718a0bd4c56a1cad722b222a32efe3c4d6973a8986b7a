import React__default, { ReactElement, FC, PropsWithChildren } from 'react';
import { Channel } from 'storybook/internal/channels';
import { Renderer, DocsContextProps } from 'storybook/internal/types';
import { ThemeVars } from 'storybook/theming';

interface TocbotOptions {
    tocSelector: string;
    contentSelector: string;
    headingSelector: string;
    ignoreSelector?: string;
    headingsOffset?: number;
    scrollSmoothOffset?: number;
    orderedList?: boolean;
    onClick?: (e: MouseEvent) => void;
    scrollEndCallback?: () => void;
    [key: string]: unknown;
}
interface TocParameters {
    /** CSS selector for the container to search for headings. */
    contentsSelector?: string;
    /**
     * When true, hide the TOC. We still show the empty container (as opposed to showing nothing at
     * all) because it affects the page layout and we want to preserve the layout across pages.
     */
    disable?: boolean;
    /** CSS selector to match headings to list in the TOC. */
    headingSelector?: string;
    /** Headings that match the ignoreSelector will be skipped. */
    ignoreSelector?: string;
    /** Custom title ReactElement or string to display above the TOC. */
    title?: ReactElement | string | null;
    /**
     * TocBot options, not guaranteed to be available in future versions.
     *
     * @see tocbot docs {@link https://tscanlin.github.io/tocbot/#usage}
     */
    unsafeTocbotOptions?: Omit<TocbotOptions, 'onClick' | 'scrollEndCallback'>;
}
type TableOfContentsProps = React__default.PropsWithChildren<TocParameters & {
    className?: string;
    channel: Channel;
}>;
declare const TableOfContents: ({ title, disable, headingSelector, contentsSelector, ignoreSelector, unsafeTocbotOptions, channel, className, }: TableOfContentsProps) => React__default.JSX.Element;

interface DocsContainerProps<TFramework extends Renderer = Renderer> {
    context: DocsContextProps<TFramework>;
    theme?: ThemeVars;
}
declare const DocsContainer: FC<PropsWithChildren<DocsContainerProps>>;

export { DocsContainerProps as D, TocParameters as T, TableOfContents as a, DocsContainer as b };
