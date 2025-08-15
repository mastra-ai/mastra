#!/usr/bin/env node

const http = require("http");
const https = require("https");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  // Test against local dev server or production
  BASE_URL: process.env.TEST_BASE_URL || "http://localhost:3000",
  TIMEOUT: 10000, // 10 seconds
  MAX_REDIRECTS: 5,
  CONCURRENT_REQUESTS: 10,
  OUTPUT_FILE: path.join(__dirname, "../redirect-test-results.json"),
  REPORT_FILE: path.join(__dirname, "../redirect-test-report.md"),
};

/**
 * Parse next.config.mjs to extract redirects
 */
function extractRedirectsFromConfig() {
  try {
    const configPath = path.join(__dirname, "../next.config.mjs");
    const configContent = fs.readFileSync(configPath, "utf8");

    // Extract redirects using regex (simplified approach)
    const redirectsMatch = configContent.match(
      /redirects:\s*\(\)\s*=>\s*\[([\s\S]*?)\]/,
    );
    if (!redirectsMatch) {
      throw new Error("Could not find redirects array in config file");
    }

    const redirectMatches = [
      ...redirectsMatch[1].matchAll(
        /\{\s*source:\s*"([^"]*)",\s*destination:\s*"([^"]*)",\s*permanent:\s*(true|false),?\s*\}/g,
      ),
    ];

    return redirectMatches.map((match) => ({
      source: match[1],
      destination: match[2],
      permanent: match[3] === "true",
    }));
  } catch (error) {
    console.error("Error parsing config file:", error.message);
    return [];
  }
}

/**
 * Make HTTP request and follow redirects manually
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = CONFIG.TIMEOUT, maxRedirects = CONFIG.MAX_REDIRECTS } =
      options;
    const redirectHistory = [];

    function request(currentUrl, redirectCount = 0) {
      if (redirectCount > maxRedirects) {
        return reject(new Error(`Too many redirects (${redirectCount})`));
      }

      const urlObj = new URL(currentUrl);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: "HEAD", // Use HEAD to avoid downloading content
        headers: {
          "User-Agent": "Redirect-Tester/1.0",
          Accept: "*/*",
        },
        timeout,
      };

      const req = client.request(requestOptions, (res) => {
        const result = {
          url: currentUrl,
          statusCode: res.statusCode,
          headers: res.headers,
          redirectHistory,
        };

        // Handle redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const nextUrl = new URL(res.headers.location, currentUrl).href;
          redirectHistory.push({
            from: currentUrl,
            to: nextUrl,
            statusCode: res.statusCode,
          });
          return request(nextUrl, redirectCount + 1);
        }

        resolve(result);
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      req.end();
    }

    request(url);
  });
}

/**
 * Test a single redirect
 */
async function testRedirect(redirect) {
  const testUrl = CONFIG.BASE_URL + redirect.source;
  const expectedDestination = CONFIG.BASE_URL + redirect.destination;

  try {
    const result = await makeRequest(testUrl);

    // Determine final URL after all redirects
    const finalUrl =
      result.redirectHistory.length > 0
        ? result.redirectHistory[result.redirectHistory.length - 1].to
        : result.url;

    // Check if redirect worked as expected
    const isSuccess =
      result.redirectHistory.length > 0 && finalUrl === expectedDestination;

    const expectedStatusCode = redirect.permanent ? 301 : 302;
    const actualStatusCode =
      result.redirectHistory.length > 0
        ? result.redirectHistory[0].statusCode
        : result.statusCode;

    return {
      source: redirect.source,
      destination: redirect.destination,
      testUrl,
      expectedDestination,
      finalUrl,
      success: isSuccess,
      statusCode: actualStatusCode,
      expectedStatusCode,
      redirectHistory: result.redirectHistory,
      error: null,
    };
  } catch (error) {
    return {
      source: redirect.source,
      destination: redirect.destination,
      testUrl,
      expectedDestination,
      finalUrl: null,
      success: false,
      statusCode: null,
      expectedStatusCode: redirect.permanent ? 301 : 302,
      redirectHistory: [],
      error: error.message,
    };
  }
}

/**
 * Run tests in batches to avoid overwhelming the server
 */
async function runTestsInBatches(
  redirects,
  batchSize = CONFIG.CONCURRENT_REQUESTS,
) {
  const results = [];
  const total = redirects.length;

  console.log(`\n🧪 Testing ${total} redirects in batches of ${batchSize}...`);

  for (let i = 0; i < redirects.length; i += batchSize) {
    const batch = redirects.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);

    console.log(
      `\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} redirects)...`,
    );

    try {
      const batchPromises = batch.map((redirect) => testRedirect(redirect));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Show progress
      const successful = batchResults.filter((r) => r.success).length;
      const failed = batchResults.filter((r) => !r.success).length;
      console.log(`   ✅ Success: ${successful}, ❌ Failed: ${failed}`);

      // Small delay between batches to be nice to the server
      if (i + batchSize < redirects.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error in batch ${batchNumber}:`, error.message);
      // Add failed results for this batch
      const failedResults = batch.map((redirect) => ({
        source: redirect.source,
        destination: redirect.destination,
        success: false,
        error: `Batch error: ${error.message}`,
      }));
      results.push(...failedResults);
    }
  }

  return results;
}

/**
 * Generate detailed test report
 */
function generateReport(results) {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const statusCodeIssues = results.filter(
    (r) => r.success && r.statusCode !== r.expectedStatusCode,
  );

  const report = {
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      statusCodeIssues: statusCodeIssues.length,
      successRate: ((successful.length / results.length) * 100).toFixed(2),
    },
    categories: {
      localeAware: results.filter((r) => r.source.includes("/:locale")),
      fallback: results.filter((r) => !r.source.includes("/:locale")),
    },
    issues: {
      failed: failed.map((r) => ({
        source: r.source,
        destination: r.destination,
        error: r.error,
        finalUrl: r.finalUrl,
      })),
      statusCodeMismatch: statusCodeIssues.map((r) => ({
        source: r.source,
        expected: r.expectedStatusCode,
        actual: r.statusCode,
      })),
    },
    details: results,
  };

  return report;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  const { summary, categories, issues } = report;

  return `# Redirect Test Report

## Summary
- **Total Redirects Tested**: ${summary.total}
- **Successful**: ${summary.successful} (${summary.successRate}%)
- **Failed**: ${summary.failed}
- **Status Code Issues**: ${summary.statusCodeIssues}

## Categories
- **Locale-Aware Redirects**: ${categories.localeAware.length} (with \`/:locale\`)
- **Fallback Redirects**: ${categories.fallback.length} (without locale)

## Issues

### Failed Redirects (${issues.failed.length})
${
  issues.failed.length === 0
    ? "*No failed redirects* ✅"
    : issues.failed
        .map(
          (issue) =>
            `- **${issue.source}** → ${issue.destination}\n  - Error: ${issue.error}\n  - Final URL: ${issue.finalUrl || "N/A"}`,
        )
        .join("\n")
}

### Status Code Mismatches (${issues.statusCodeMismatch.length})
${
  issues.statusCodeMismatch.length === 0
    ? "*No status code issues* ✅"
    : issues.statusCodeMismatch
        .map(
          (issue) =>
            `- **${issue.source}**: Expected ${issue.expected}, got ${issue.actual}`,
        )
        .join("\n")
}

## Test Configuration
- **Base URL**: ${CONFIG.BASE_URL}
- **Timeout**: ${CONFIG.TIMEOUT}ms
- **Max Redirects**: ${CONFIG.MAX_REDIRECTS}
- **Concurrent Requests**: ${CONFIG.CONCURRENT_REQUESTS}

Generated on: ${new Date().toISOString()}
`;
}

/**
 * Main test function
 */
async function runRedirectTests() {
  console.log("🚀 Starting comprehensive redirect testing...");
  console.log(`📍 Testing against: ${CONFIG.BASE_URL}`);

  // Extract redirects from config
  console.log("\n📋 Extracting redirects from next.config.mjs...");
  const redirects = extractRedirectsFromConfig();

  if (redirects.length === 0) {
    console.error("❌ No redirects found in configuration");
    process.exit(1);
  }

  console.log(`📊 Found ${redirects.length} redirects to test`);

  // Run tests
  const startTime = Date.now();
  const results = await runTestsInBatches(redirects);
  const endTime = Date.now();

  // Generate report
  const report = generateReport(results);
  const markdownReport = generateMarkdownReport(report);

  // Save results
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(report, null, 2));
  fs.writeFileSync(CONFIG.REPORT_FILE, markdownReport);

  // Display summary
  console.log(`\n📈 Test Results Summary:`);
  console.log(`   Total: ${report.summary.total}`);
  console.log(
    `   ✅ Successful: ${report.summary.successful} (${report.summary.successRate}%)`,
  );
  console.log(`   ❌ Failed: ${report.summary.failed}`);
  console.log(`   ⚠️  Status Code Issues: ${report.summary.statusCodeIssues}`);
  console.log(`   ⏱️  Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);

  console.log(`\n📄 Detailed reports saved:`);
  console.log(`   JSON: ${CONFIG.OUTPUT_FILE}`);
  console.log(`   Markdown: ${CONFIG.REPORT_FILE}`);

  if (report.summary.failed > 0) {
    console.log(
      `\n❌ ${report.summary.failed} redirects failed. Check the report for details.`,
    );
    process.exit(1);
  } else {
    console.log(`\n✅ All redirects working correctly!`);
  }
}

// Export functions for use in other scripts
module.exports = {
  runRedirectTests,
  testRedirect,
  extractRedirectsFromConfig,
  CONFIG,
};

// Run tests if this script is executed directly
if (require.main === module) {
  runRedirectTests().catch((error) => {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  });
}
