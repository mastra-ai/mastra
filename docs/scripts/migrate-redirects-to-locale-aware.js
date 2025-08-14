#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const NEXT_CONFIG_PATH = path.join(__dirname, "../next.config.mjs");

/**
 * Check if a redirect should be locale-aware
 * @param {Object} redirect - The redirect object
 * @returns {boolean} - Whether this redirect should be locale-aware
 */
function shouldBeLocaleAware(redirect) {
  const { source, destination } = redirect;

  // Skip if already locale-aware
  if (source.includes("/:locale") || source.startsWith("/:locale")) {
    return false;
  }

  // Skip API routes, static assets, and special Next.js routes
  if (
    source.startsWith("/api/") ||
    source.startsWith("/_next/") ||
    source.startsWith("/static/") ||
    source.includes("/_next/")
  ) {
    return false;
  }

  // Skip root redirects that don't involve docs content
  if (source === "/" || destination === "/") {
    return false;
  }

  // Make locale-aware if it involves docs content areas
  const contentAreas = [
    "/docs/",
    "/examples/",
    "/guides/",
    "/reference/",
    "/showcase/",
  ];
  const involvesContent = contentAreas.some(
    (area) =>
      source.startsWith(area) ||
      source.includes(area) ||
      destination.startsWith(area) ||
      destination.includes(area),
  );

  return involvesContent;
}

/**
 * Convert a redirect to be locale-aware
 * @param {Object} redirect - The redirect object
 * @returns {Object[]} - Array of locale-aware redirects
 */
function convertToLocaleAware(redirect) {
  const { source, destination, permanent } = redirect;

  // Create locale-aware version
  const localeAwareRedirect = {
    source: `/:locale${source}`,
    destination: `/:locale${destination}`,
    permanent,
  };

  // Create fallback redirect for non-locale URLs (redirect to default locale)
  const fallbackRedirect = {
    source: source,
    destination: `/en${destination}`,
    permanent: false, // Use temporary redirect for fallbacks
  };

  return [localeAwareRedirect, fallbackRedirect];
}

/**
 * Process all redirects and convert appropriate ones to locale-aware
 * @param {Object[]} redirects - Array of redirect objects
 * @returns {Object[]} - Updated array of redirects
 */
function processRedirects(redirects) {
  const newRedirects = [];
  const stats = {
    total: redirects.length,
    converted: 0,
    skipped: 0,
    alreadyLocaleAware: 0,
  };

  console.log(`Processing ${redirects.length} redirects...`);

  for (const redirect of redirects) {
    if (redirect.source.includes("/:locale")) {
      // Already locale-aware, keep as is
      newRedirects.push(redirect);
      stats.alreadyLocaleAware++;
    } else if (shouldBeLocaleAware(redirect)) {
      // Convert to locale-aware
      const convertedRedirects = convertToLocaleAware(redirect);
      newRedirects.push(...convertedRedirects);
      stats.converted++;
      console.log(`✓ Converted: ${redirect.source} → ${redirect.destination}`);
    } else {
      // Keep as is
      newRedirects.push(redirect);
      stats.skipped++;
    }
  }

  console.log(`\nConversion Statistics:`);
  console.log(`- Total redirects processed: ${stats.total}`);
  console.log(`- Converted to locale-aware: ${stats.converted}`);
  console.log(`- Already locale-aware: ${stats.alreadyLocaleAware}`);
  console.log(`- Skipped (not content-related): ${stats.skipped}`);
  console.log(`- New total redirects: ${newRedirects.length}`);

  return newRedirects;
}

/**
 * Parse the next.config.mjs file and extract redirects
 * @param {string} configContent - The content of next.config.mjs
 * @returns {Object} - Parsed config with redirects
 */
function parseConfig(configContent) {
  // This is a simplified parser - in a real scenario you might want to use a proper JS parser
  // For now, we'll work with string manipulation since the config has a known structure

  const redirectsMatch = configContent.match(
    /redirects:\s*\(\)\s*=>\s*\[([\s\S]*?)\]/,
  );
  if (!redirectsMatch) {
    throw new Error("Could not find redirects array in config file");
  }

  return {
    content: configContent,
    redirectsSection: redirectsMatch[1],
    redirectsStart: redirectsMatch.index + redirectsMatch[0].indexOf("[") + 1,
    redirectsEnd: redirectsMatch.index + redirectsMatch[0].length - 1,
  };
}

/**
 * Generate the new redirects array as a string
 * @param {Object[]} redirects - Array of redirect objects
 * @returns {string} - Formatted redirects array
 */
function generateRedirectsString(redirects) {
  const redirectStrings = redirects.map((redirect) => {
    const sourceStr = JSON.stringify(redirect.source);
    const destStr = JSON.stringify(redirect.destination);
    const permanentStr = redirect.permanent ? "true" : "false";

    return `      {\n        source: ${sourceStr},\n        destination: ${destStr},\n        permanent: ${permanentStr},\n      }`;
  });

  return redirectStrings.join(",\n");
}

/**
 * Main function to migrate redirects
 */
async function migrateRedirects() {
  try {
    console.log("🚀 Starting redirect migration to locale-aware format...\n");

    // Read the current config file
    console.log("📖 Reading next.config.mjs...");
    const configContent = fs.readFileSync(NEXT_CONFIG_PATH, "utf8");

    // Create backup
    const backupPath = NEXT_CONFIG_PATH + ".backup." + Date.now();
    fs.writeFileSync(backupPath, configContent);
    console.log(`📋 Created backup at: ${backupPath}`);

    // Parse current config
    const config = parseConfig(configContent);

    // Extract current redirects using regex (simplified approach)
    const redirectMatches = [
      ...config.redirectsSection.matchAll(
        /\{\s*source:\s*"([^"]*)",\s*destination:\s*"([^"]*)",\s*permanent:\s*(true|false),?\s*\}/g,
      ),
    ];

    const currentRedirects = redirectMatches.map((match) => ({
      source: match[1],
      destination: match[2],
      permanent: match[3] === "true",
    }));

    console.log(`📊 Found ${currentRedirects.length} redirects in config\n`);

    // Process redirects
    const newRedirects = processRedirects(currentRedirects);

    // Generate new config content
    const newRedirectsString = generateRedirectsString(newRedirects);
    const newConfigContent =
      configContent.substring(0, config.redirectsStart) +
      "\n" +
      newRedirectsString +
      "\n    " +
      configContent.substring(config.redirectsEnd);

    // Write the updated config
    fs.writeFileSync(NEXT_CONFIG_PATH, newConfigContent);

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📝 Updated next.config.mjs with locale-aware redirects`);
    console.log(`💾 Backup saved at: ${backupPath}`);
    console.log(
      `\n⚠️  Please test the changes before deploying to production!`,
    );
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateRedirects();
}

module.exports = {
  migrateRedirects,
  shouldBeLocaleAware,
  convertToLocaleAware,
};
