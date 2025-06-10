/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  generateRobotsTxt: true,
  exclude: ["*/_meta"],
  generateIndexSitemap: false,
  robotsTxtOptions: {
    additionalSitemaps: [],
    transformRobotsTxt: async (_, robotsTxt) => {
      // Add Algolia crawler verification if provided
      const algoliaVerif = process.env.ALGOLIA_CRAWLER_VERIF;
      const algoliaVerifLine = algoliaVerif
        ? `# Algolia-Crawler-Verif: ${algoliaVerif}\n\n`
        : "";

      return `${algoliaVerifLine}${robotsTxt}

# Allow Algolia crawler
User-agent: Algolia Crawler
Allow: /`;
    },
  },
  // ...other options
};

export default config;
