import { createRequire } from 'module';
import { URL } from 'url';

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const baseUrl = process.env.MASTRA_DEPLOYMENT_URL || 'https://mastra.ai';
const basePaths = ['/docs', '/examples', '/guides', '/reference', '/showcase'];
const linksToSkip = ['http://localhost', 'https://localhost'];

const sidebarLinksByPath = {};
const start = Date.now();

let pagesFetched = 0;
let totalLinksChecked = 0;
let okCount = 0;
let brokenCount = 0;
let skippedCount = 0;
const statusCodes = {};

const fetchHtml = async url => {
  const res = await fetch(url);
  return await res.text();
};

const checkLink = async ({ text, url }) => {
  if (linksToSkip.some(skip => url.startsWith(skip))) {
    skippedCount++;
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const status = res.status;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
    totalLinksChecked++;

    if (status === 404) {
      brokenCount++;
      console.log(`${RED}├───BROKEN───${RESET} [${text}](${url}) [${status}]`);
    } else {
      okCount++;
      console.log(`${GREEN}├───OK───────${RESET} [${text}](${url}) [${status}]`);
    }
  } catch {
    skippedCount++;
    console.log(`${RED}├───ERROR────${RESET} [${text}](${url})`);
  }
};

for (const basePath of basePaths) {
  const basePage = `${baseUrl}${basePath}`;
  try {
    const html = await fetchHtml(basePage);
    const $ = cheerio.load(html);
    const links = [];

    $('aside.nextra-sidebar a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('mailto:') || href.includes('#')) return;
      const absolute = new URL(href, basePage).toString();
      if (absolute.startsWith(`${baseUrl}${basePath}`)) {
        links.push(absolute);
      }
    });

    if (links.length === 0) {
      console.log(`No sidebar links found for ${basePage}, falling back to main content.`);
      const toc = $('nav.nextra-toc');
      const article = toc.nextAll('article').first();
      const main = article.find('main').first();

      main.find('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('mailto:') || href.includes('#')) return;

        const absolute = new URL(href, basePage).toString();
        links.push(absolute);
      });
    }

    sidebarLinksByPath[basePath] = links;

    for (const link of links) console.log(`- ${link}`);
    console.log(`LINKS (${basePage}): ${links.length}\n`);
  } catch (err) {
    console.error(`${RED}Failed to fetch ${basePage}:${RESET} ${err.message}`);
  }
}

for (const [basePath, pageUrls] of Object.entries(sidebarLinksByPath)) {
  for (const pageUrl of pageUrls.filter(url => url !== `${baseUrl}${basePath}`)) {
    if (!pageUrl.startsWith(baseUrl)) {
      await checkLink({ text: pageUrl, url: pageUrl });
      continue;
    }

    try {
      const html = await fetchHtml(pageUrl);
      const $ = cheerio.load(html);
      pagesFetched++;

      const toc = $('nav.nextra-toc');
      const article = toc.nextAll('article').first();
      const main = article.find('main').first();
      const mainLinks = [];

      main.find('a[href]').each((_, el) => {
        if ($(el).closest('.nextra-breadcrumb').length > 0) return;

        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const href = $(el).attr('href');

        if (!href || href.startsWith('mailto:') || href.startsWith('#')) {
          skippedCount++;
          return;
        }

        const absolute = new URL(href, pageUrl).toString();
        mainLinks.push({ text, url: absolute });
      });

      console.log(`\n- ${pageUrl}`);
      for (const link of mainLinks) {
        await checkLink(link);
      }

      console.log(`Links checked: ${mainLinks.length}`);
    } catch (err) {
      console.error(`${RED}├───FAILED───${RESET} ${pageUrl}:${RESET} ${err.message}`);
    }
  }
}

const elapsed = Math.floor((Date.now() - start) / 1000);
const minutes = Math.floor(elapsed / 60);
const seconds = elapsed % 60;

console.log(
  brokenCount > 0
    ? `\n${RED}Completed with broken links${RESET}`
    : `\n${GREEN}Completed successfully (no broken links)${RESET}`,
);

console.log('\n' + '='.repeat(40));
console.log(`Pages fetched: ${pagesFetched}`);
console.log(`Total links checked: ${totalLinksChecked}`);
console.log(`Ok: ${okCount}`);
console.log(`Broken: ${brokenCount}`);
console.log(`Skipped/untracked: ${skippedCount}`);
console.log('Status codes:');
for (const code of Object.keys(statusCodes).sort((a, b) => a - b)) {
  console.log(`- ${code}: ${statusCodes[code]}`);
}
console.log(`Time elapsed: ${minutes} minutes, ${seconds} seconds`);
console.log('='.repeat(40));

process.exit(brokenCount > 0 ? 1 : 0);
