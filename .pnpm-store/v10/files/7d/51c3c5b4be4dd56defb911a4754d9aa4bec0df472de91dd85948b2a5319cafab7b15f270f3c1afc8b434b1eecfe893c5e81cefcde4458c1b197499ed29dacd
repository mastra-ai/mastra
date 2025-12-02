// List of blocked user agent strings that identify bots
// This is shared between browser and node SDKs to ensure consistent bot detection
export const DEFAULT_BLOCKED_UA_STRS = [
  // Random assortment of bots
  'amazonbot',
  'amazonproductbot',
  'app.hypefactors.com', // Buck, but "buck" is too short to be safe to block (https://app.hypefactors.com/media-monitoring/about.htm)
  'applebot',
  'archive.org_bot',
  'awariobot',
  'backlinksextendedbot',
  'baiduspider',
  'bingbot',
  'bingpreview',
  'chrome-lighthouse',
  'dataforseobot',
  'deepscan',
  'duckduckbot',
  'facebookexternal',
  'facebookcatalog',
  'http://yandex.com/bots',
  'hubspot',
  'ia_archiver',
  'leikibot',
  'linkedinbot',
  'meta-externalagent',
  'mj12bot',
  'msnbot',
  'nessus',
  'petalbot',
  'pinterest',
  'prerender',
  'rogerbot',
  'screaming frog',
  'sebot-wa',
  'sitebulb',
  'slackbot',
  'slurp',
  'trendictionbot',
  'turnitin',
  'twitterbot',
  'vercel-screenshot',
  'vercelbot',
  'yahoo! slurp',
  'yandexbot',
  'zoombot',

  // Bot-like words, maybe we should block `bot` entirely?
  'bot.htm',
  'bot.php',
  '(bot;',
  'bot/',
  'crawler',

  // Ahrefs: https://ahrefs.com/seo/glossary/ahrefsbot
  'ahrefsbot',
  'ahrefssiteaudit',

  // Semrush bots: https://www.semrush.com/bot/
  'semrushbot',
  'siteauditbot',
  'splitsignalbot',

  // AI Crawlers
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'perplexitybot',

  // Uptime-like stuff
  'better uptime bot',
  'sentryuptimebot',
  'uptimerobot',

  // headless browsers
  'headlesschrome',
  'cypress',
  // we don't block electron here, as many customers use posthog-js in electron apps

  // a whole bunch of goog-specific crawlers
  // https://developers.google.com/search/docs/advanced/crawling/overview-google-crawlers
  'google-hoteladsverifier',
  'adsbot-google',
  'apis-google',
  'duplexweb-google',
  'feedfetcher-google',
  'google favicon',
  'google web preview',
  'google-read-aloud',
  'googlebot',
  'googleother',
  'google-cloudvertexbot',
  'googleweblight',
  'mediapartners-google',
  'storebot-google',
  'google-inspectiontool',
  'bytespider',
]

/**
 * Block various web spiders from executing our JS and sending false capturing data
 */
export const isBlockedUA = function (ua: string | undefined, customBlockedUserAgents: string[] = []): boolean {
  if (!ua) {
    return false
  }

  const uaLower = ua.toLowerCase()
  return DEFAULT_BLOCKED_UA_STRS.concat(customBlockedUserAgents).some((blockedUA) => {
    const blockedUaLower = blockedUA.toLowerCase()
    // can't use includes because IE 11 :/
    return uaLower.indexOf(blockedUaLower) !== -1
  })
}
