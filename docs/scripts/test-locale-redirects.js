#!/usr/bin/env node

const { testRedirect, CONFIG } = require("./test-redirects");
const fs = require("fs");
const path = require("path");

/**
 * Generate test cases for locale-specific scenarios
 */
function generateLocaleTestCases() {
  const testCases = [
    // Test locale-aware redirects for both locales
    {
      name: "English locale-aware redirect",
      source: "/en/docs/08-running-evals",
      expectedDestination: "/en/docs/evals/overview",
      permanent: true,
    },
    {
      name: "Japanese locale-aware redirect",
      source: "/ja/docs/08-running-evals",
      expectedDestination: "/ja/docs/evals/overview",
      permanent: true,
    },

    // Test fallback redirects
    {
      name: "Fallback redirect (no locale)",
      source: "/docs/08-running-evals",
      expectedDestination: "/en/docs/evals/overview",
      permanent: false,
    },

    // Test various content areas
    {
      name: "Examples redirect (EN)",
      source: "/en/examples/memory",
      expectedDestination: "/en/examples/memory/memory-with-libsql",
      permanent: true,
    },
    {
      name: "Examples redirect (JA)",
      source: "/ja/examples/memory",
      expectedDestination: "/ja/examples/memory/memory-with-libsql",
      permanent: true,
    },
    {
      name: "Reference redirect (EN)",
      source: "/en/docs/reference",
      expectedDestination: "/en/reference",
      permanent: true,
    },
    {
      name: "Reference redirect (JA)",
      source: "/ja/docs/reference",
      expectedDestination: "/ja/reference",
      permanent: true,
    },
    {
      name: "Guides redirect (EN)",
      source: "/en/docs/guide",
      expectedDestination: "/en/guides",
      permanent: true,
    },
    {
      name: "Guides redirect (JA)",
      source: "/ja/docs/guide",
      expectedDestination: "/ja/guides",
      permanent: true,
    },

    // Test wildcard redirects
    {
      name: "Wildcard redirect (EN)",
      source: "/en/workflows/some-path",
      expectedDestination: "/en/docs/workflows/some-path",
      permanent: true,
    },
    {
      name: "Wildcard redirect (JA)",
      source: "/ja/workflows/some-path",
      expectedDestination: "/ja/docs/workflows/some-path",
      permanent: true,
    },

    // Test that already locale-aware redirects still work
    {
      name: "Existing locale-aware redirect (EN)",
      source: "/en/docs/deployment/deployment",
      expectedDestination: "/en/docs/deployment/serverless-platforms",
      permanent: true,
    },
    {
      name: "Existing locale-aware redirect (JA)",
      source: "/ja/docs/deployment/deployment",
      expectedDestination: "/ja/docs/deployment/serverless-platforms",
      permanent: true,
    },

    // Test anchor links work correctly
    {
      name: "Anchor link redirect (EN)",
      source: "/en/docs/local-dev/add-to-existing-project",
      expectedDestination:
        "/en/docs/getting-started/installation#add-to-an-existing-project",
      permanent: true,
    },
    {
      name: "Anchor link redirect (JA)",
      source: "/ja/docs/local-dev/add-to-existing-project",
      expectedDestination:
        "/ja/docs/getting-started/installation#add-to-an-existing-project",
      permanent: true,
    },
  ];

  return testCases;
}

/**
 * Test locale-specific edge cases
 */
function generateEdgeCaseTests() {
  return [
    // Test that non-existent locales don't break
    {
      name: "Invalid locale (should 404)",
      source: "/fr/docs/agents/overview",
      expectedDestination: null, // Should 404
      expectError: true,
    },

    // Test root locale paths
    {
      name: "Root locale redirect (EN)",
      source: "/en",
      expectedDestination: "/en",
      expectRedirect: false,
    },
    {
      name: "Root locale redirect (JA)",
      source: "/ja",
      expectedDestination: "/ja",
      expectRedirect: false,
    },

    // Test case sensitivity
    {
      name: "Case sensitive path (should 404)",
      source: "/en/DOCS/agents/overview",
      expectedDestination: null,
      expectError: true,
    },
  ];
}

/**
 * Run comprehensive locale testing
 */
async function runLocaleTests() {
  console.log("🌍 Starting locale-specific redirect testing...");

  const testCases = [...generateLocaleTestCases(), ...generateEdgeCaseTests()];

  console.log(`📋 Testing ${testCases.length} locale-specific scenarios...`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 [${i + 1}/${testCases.length}] ${testCase.name}`);

    try {
      const result = await testRedirect({
        source: testCase.source,
        destination: testCase.expectedDestination || testCase.source,
        permanent: testCase.permanent || false,
      });

      // Custom validation for edge cases
      if (testCase.expectError) {
        result.success = result.statusCode >= 400;
        result.customValidation = `Expected error status, got ${result.statusCode}`;
      } else if (testCase.expectRedirect === false) {
        result.success =
          result.redirectHistory.length === 0 && result.statusCode === 200;
        result.customValidation = `Expected no redirect, got ${result.redirectHistory.length} redirects`;
      }

      result.testName = testCase.name;
      results.push(result);

      if (result.success) {
        console.log(`   ✅ ${testCase.name} - PASSED`);
      } else {
        console.log(`   ❌ ${testCase.name} - FAILED`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
        if (result.customValidation) {
          console.log(`      Details: ${result.customValidation}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ${testCase.name} - ERROR: ${error.message}`);
      results.push({
        testName: testCase.name,
        source: testCase.source,
        destination: testCase.expectedDestination,
        success: false,
        error: error.message,
      });
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  // Generate report
  const report = {
    summary: {
      total: results.length,
      successful,
      failed,
      successRate: ((successful / results.length) * 100).toFixed(2),
      duration: ((endTime - startTime) / 1000).toFixed(2),
    },
    results,
  };

  // Save results
  const outputFile = path.join(
    __dirname,
    "../locale-redirect-test-results.json",
  );
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));

  // Generate markdown report
  const markdownReport = `# Locale-Specific Redirect Test Report

## Summary
- **Total Tests**: ${report.summary.total}
- **Successful**: ${report.summary.successful} (${report.summary.successRate}%)
- **Failed**: ${report.summary.failed}
- **Duration**: ${report.summary.duration}s

## Test Results

${results
  .map(
    (result) => `
### ${result.testName}
- **Source**: ${result.source}
- **Expected**: ${result.destination || "N/A"}
- **Result**: ${result.success ? "✅ PASSED" : "❌ FAILED"}
${result.error ? `- **Error**: ${result.error}` : ""}
${result.customValidation ? `- **Details**: ${result.customValidation}` : ""}
${result.finalUrl ? `- **Final URL**: ${result.finalUrl}` : ""}
`,
  )
  .join("\n")}

Generated on: ${new Date().toISOString()}
`;

  const reportFile = path.join(__dirname, "../locale-redirect-test-report.md");
  fs.writeFileSync(reportFile, markdownReport);

  console.log(`\n📊 Locale Test Summary:`);
  console.log(`   Total: ${report.summary.total}`);
  console.log(
    `   ✅ Successful: ${successful} (${report.summary.successRate}%)`,
  );
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Duration: ${report.summary.duration}s`);

  console.log(`\n📄 Reports saved:`);
  console.log(`   JSON: ${outputFile}`);
  console.log(`   Markdown: ${reportFile}`);

  if (failed > 0) {
    console.log(`\n❌ ${failed} locale tests failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All locale tests passed!`);
  }
}

// Run if called directly
if (require.main === module) {
  runLocaleTests().catch((error) => {
    console.error("❌ Locale test execution failed:", error);
    process.exit(1);
  });
}

module.exports = { runLocaleTests };
