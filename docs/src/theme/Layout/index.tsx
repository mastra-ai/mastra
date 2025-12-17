import ErrorBoundary from "@docusaurus/ErrorBoundary";
import Head from "@docusaurus/Head";
import {
  PageMetadata,
  SkipToContentFallbackId,
  ThemeClassNames,
} from "@docusaurus/theme-common";
import { useKeyboardNavigation } from "@docusaurus/theme-common/internal";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import AnnouncementBar from "@theme/AnnouncementBar";
import ErrorPageContent from "@theme/ErrorPageContent";
import Footer from "@theme/Footer";
import type { Props } from "@theme/Layout";
import LayoutProvider from "@theme/Layout/Provider";
import Navbar from "@theme/Navbar";
import SkipToContent from "@theme/SkipToContent";
import clsx from "clsx";
import { useMemo, type ReactNode } from "react";
import styles from "./styles.module.css";

import FeatureVersioning from "../../../feature-versioning.json";

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
  const { siteConfig } = useDocusaurusContext();

  const v0CanonicalUrl = useMemo(() => {
    const cleanPath = location.pathname
      .replace(/^\/ja(\/|$)/, "/")
      .replace(/^\/([a-z]+)\/v1(\/|$)/, "/$1$2");
    return Object.keys(FeatureVersioning).includes(cleanPath)
      ? null
      : `${siteConfig.url}${cleanPath}`;
  }, [location, siteConfig]);

  return (
    <LayoutProvider>
      <PageMetadata title={title} description={description} />

      <Head>
        {v0CanonicalUrl && <link rel="canonical" href={v0CanonicalUrl} />}
        <meta name="x-docs-origin" content="v1" />
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
