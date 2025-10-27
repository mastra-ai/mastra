import React, { type ReactNode } from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";

export default function DocItemMetadata(): ReactNode {
  const { metadata, frontMatter, assets } = useDoc();

  // Generate dynamic OG image URL from your API, or use manually specified image
  const ogImage =
    assets.image ??
    frontMatter.image ??
    `https://mastra.ai/api/og/docs?title=${encodeURIComponent(metadata.title)}&date=${encodeURIComponent(metadata.lastUpdatedAt || "")}`;

  return (
    <PageMetadata
      title={metadata.title}
      description={metadata.description}
      keywords={frontMatter.keywords}
      image={ogImage}
    />
  );
}
