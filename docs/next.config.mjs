/** @type {import('next').NextConfig} */
import nextra from "nextra";

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
});

export default withNextra({
  assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : "",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/docs/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },
  redirects: () => [
    {
      source: "/docs/08-running-evals",
      destination: "/docs/evals/00-overview",
      permanent: true,
    },
  ],
  trailingSlash: false,
});
