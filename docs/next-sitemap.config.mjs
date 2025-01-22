/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  generateRobotsTxt: true,
  exclude: ["*/_meta"],
  generateIndexSitemap: false,
  // ...other options
};

export default config;
