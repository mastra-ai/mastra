import ErrorBoundary from "@docusaurus/ErrorBoundary";
import Head from "@docusaurus/Head";
import {
  PageMetadata,
  SkipToContentFallbackId,
  ThemeClassNames,
} from "@docusaurus/theme-common";
import { useKeyboardNavigation } from "@docusaurus/theme-common/internal";
import { useLocation } from "@docusaurus/router";
import AnnouncementBar from "@theme/AnnouncementBar";
import ErrorPageContent from "@theme/ErrorPageContent";
import Footer from "@theme/Footer";
import type { Props } from "@theme/Layout";
import LayoutProvider from "@theme/Layout/Provider";
import Navbar from "@theme/Navbar";
import SkipToContent from "@theme/SkipToContent";
import clsx from "clsx";
import { type ReactNode } from "react";
import styles from "./styles.module.css";

export default function Layout(props: Props): ReactNode {
  const {
    children,
    noFooter,
    wrapperClassName,
    // Not really layout-related, but kept for convenience/retro-compatibility
    title,
    description,
  } = props;

  useKeyboardNavigation();

  const location = useLocation();
  const currentUrl = `https://mastra.ai${location.pathname}`;

  // Remove /ja/ prefix if present to get the base path
  const cleanPath = location.pathname.replace(/^\/ja\//, "/");

  return (
    <LayoutProvider>
      <PageMetadata title={title} description={description} />

      <Head>
        <link rel="canonical" href={currentUrl} />
        <link
          rel="alternate"
          hrefLang="en"
          href={`https://mastra.ai${cleanPath}`}
        />
        <link
          rel="alternate"
          hrefLang="ja"
          href={`https://mastra.ai/ja${cleanPath}`}
        />
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`https://mastra.ai${cleanPath}`}
        />
      </Head>

      <SkipToContent />

      <AnnouncementBar />

      <Navbar />

      <div
        id={SkipToContentFallbackId}
        className={clsx(
          ThemeClassNames.layout.main.container,
          ThemeClassNames.wrapper.main,
          styles.mainWrapper,
          wrapperClassName,
        )}
      >
        <ErrorBoundary fallback={(params) => <ErrorPageContent {...params} />}>
          {children}
        </ErrorBoundary>
      </div>

      {!noFooter && <Footer />}
    </LayoutProvider>
  );
}
