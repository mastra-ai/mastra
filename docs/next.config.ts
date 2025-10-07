/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { initGT } from "gt-next/config";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync } from "fs";
import { redirectList } from "./config/redirects.mjs";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : "",
  i18n: {
    locales: ["en", "ja"],
    defaultLocale: "en",
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/en/docs/api/copilotkit",
          destination: "/api/copilotkit",
        },
        {
          source: "/ja/docs/api/copilotkit",
          destination: "/api/copilotkit",
        },
        {
          source: "/docs/api/copilotkit",
          destination: "/api/copilotkit",
        },
        {
          source: "/en/docs/api/feedback",
          destination: "/api/feedback",
        },
        {
          source: "/ja/docs/api/feedback",
          destination: "/api/feedback",
        },
        {
          source: "/docs/api/feedback",
          destination: "/api/feedback",
        },
        {
          source: "/:locale/docs/_next/:path+",
          destination: "/_next/:path+",
        },
        {
          source: "/docs/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },
  redirects: () => Promise.resolve(redirectList),
  trailingSlash: false,
};

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: JSON.parse(
        readFileSync(path.join(process.cwd(), "theme.json"), "utf-8"),
      ),
      transformers: [transformerNotationDiff()],
    },
  },
  unstable_shouldAddLocaleToLinks: true,
});

export default initGT({})(withVercelToolbar()(withNextra(nextConfig)));
