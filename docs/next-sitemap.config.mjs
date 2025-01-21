/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ["*/_meta"],
};

export default config;
