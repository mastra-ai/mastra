/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  exclude: ["*/_meta"],
  generateIndexSitemap: false,
  generateRobotsTxt: true,
};

export default config;
