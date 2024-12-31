/** @type {import('next').NextConfig} */
import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        dark: "github-dark",
        light: "github-light",
      },
    },
  },
});

export default withNextra({
  basePath: "",
  trailingSlash: false,
  rewrites: async () => [
    {
      source: "/docs",
      destination: "/docs/root",
    },
  ],
});
