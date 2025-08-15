#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Run a script and capture output
 */
function runScript(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      if (options.showOutput !== false) {
        process.stdout.write(data);
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      if (options.showOutput !== false) {
        process.stderr.write(data);
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        reject(
          new Error(
            `Script ${scriptPath} exited with code ${code}\nStderr: ${stderr}`,
          ),
        );
      }
    });

    child.on("error", reject);
  });
}

/**
 * Check if server is running
 */
async function checkServer(url) {
  const http = require("http");
  const https = require("https");
  const { URL } = require("url");

  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === "https:" ? https : http;

      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
          path: "/",
          method: "HEAD",
          timeout: 5000,
        },
        (res) => {
          resolve(true);
        },
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Start development server
 */
async function startDevServer() {
  console.log("🚀 Starting Next.js development server...");

  const child = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.join(__dirname, ".."),
  });

  return new Promise((resolve, reject) => {
    let resolved = false;

    const onData = (data) => {
      const output = data.toString();
      if (output.includes("Ready in") || output.includes("Local:")) {
        if (!resolved) {
          resolved = true;
          resolve(child);
        }
      }
      // Show server output
      process.stdout.write(output);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Server startup timeout"));
      }
    }, 60000);
  });
}

/**
 * Generate combined test report
 */
function generateCombinedReport() {
  const resultsDir = path.join(__dirname, "..");
  const reports = [];

  // Collect all test results
  const files = [
    "redirect-test-results.json",
    "locale-redirect-test-results.json",
  ];

  for (const file of files) {
    const filePath = path.join(resultsDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        reports.push({
          type: file.replace("-results.json", ""),
          data,
        });
      } catch (error) {
        console.warn(`Warning: Could not parse ${file}`);
      }
    }
  }

  // Calculate combined statistics
  let totalTests = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  reports.forEach((report) => {
    totalTests += report.data.summary.total || 0;
    totalSuccessful += report.data.summary.successful || 0;
    totalFailed += report.data.summary.failed || 0;
  });

  const successRate =
    totalTests > 0 ? ((totalSuccessful / totalTests) * 100).toFixed(2) : "0";

  const combinedReport = `# Combined Redirect Test Report

## Overall Summary
- **Total Tests**: ${totalTests}
- **Successful**: ${totalSuccessful} (${successRate}%)
- **Failed**: ${totalFailed}

${reports
  .map(
    (report) => `
## ${report.type.replace("-", " ").replace(/\\b\\w/g, (l) => l.toUpperCase())} Results
- **Tests**: ${report.data.summary.total}
- **Successful**: ${report.data.summary.successful} (${report.data.summary.successRate || "0"}%)
- **Failed**: ${report.data.summary.failed}
${report.data.summary.duration ? `- **Duration**: ${report.data.summary.duration}s` : ""}
`,
  )
  .join("")}

## Test Status
${totalFailed === 0 ? "✅ All tests passed successfully!" : `❌ ${totalFailed} tests failed. Check individual reports for details.`}

Generated on: ${new Date().toISOString()}
`;

  fs.writeFileSync(
    path.join(resultsDir, "combined-test-report.md"),
    combinedReport,
  );
  return { totalTests, totalSuccessful, totalFailed, successRate };
}

/**
 * Main test runner
 */
async function runAllTests() {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  const skipServerStart = process.env.SKIP_SERVER_START === "true";

  console.log("🧪 Starting comprehensive redirect testing suite...");
  console.log(`📍 Target URL: ${baseUrl}`);

  let devServer = null;

  try {
    // Check if server is already running or start it
    if (!skipServerStart) {
      const isServerRunning = await checkServer(baseUrl);

      if (!isServerRunning) {
        if (baseUrl.includes("localhost")) {
          devServer = await startDevServer();
          console.log("✅ Development server started");

          // Wait a bit more for the server to be fully ready
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          console.error(`❌ Server at ${baseUrl} is not accessible`);
          process.exit(1);
        }
      } else {
        console.log("✅ Server is already running");
      }
    }

    // Run comprehensive redirect tests
    console.log("\\n" + "=".repeat(60));
    console.log("📋 Running comprehensive redirect tests...");
    console.log("=".repeat(60));

    await runScript(path.join(__dirname, "test-redirects.js"), [], {
      env: { TEST_BASE_URL: baseUrl },
    });

    // Run locale-specific tests
    console.log("\\n" + "=".repeat(60));
    console.log("🌍 Running locale-specific tests...");
    console.log("=".repeat(60));

    await runScript(path.join(__dirname, "test-locale-redirects.js"), [], {
      env: { TEST_BASE_URL: baseUrl },
    });

    // Generate combined report
    console.log("\\n" + "=".repeat(60));
    console.log("📊 Generating combined report...");
    console.log("=".repeat(60));

    const stats = generateCombinedReport();

    console.log("\\n🎉 All tests completed successfully!");
    console.log("\\n📊 Final Summary:");
    console.log(`   Total Tests: ${stats.totalTests}`);
    console.log(
      `   ✅ Successful: ${stats.totalSuccessful} (${stats.successRate}%)`,
    );
    console.log(`   ❌ Failed: ${stats.totalFailed}`);

    console.log("\\n📄 Reports generated:");
    console.log("   - redirect-test-report.md");
    console.log("   - locale-redirect-test-report.md");
    console.log("   - combined-test-report.md");

    if (stats.totalFailed > 0) {
      console.log(
        `\\n❌ ${stats.totalFailed} tests failed. Review the reports for details.`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("\\n❌ Test suite failed:", error.message);
    process.exit(1);
  } finally {
    // Clean up development server
    if (devServer) {
      console.log("\\n🛑 Stopping development server...");
      devServer.kill("SIGTERM");

      // Wait for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Run if called directly
if (require.main === module) {
  // Handle command line arguments
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: node run-all-tests.js [options]

Options:
  --help, -h              Show this help message
  --url <url>            Test against specific URL (default: http://localhost:3000)
  --skip-server-start    Don't start development server
  
Environment Variables:
  TEST_BASE_URL          Base URL for testing (default: http://localhost:3000)
  SKIP_SERVER_START      Set to 'true' to skip server startup

Examples:
  node run-all-tests.js
  node run-all-tests.js --url https://docs.mastra.ai
  TEST_BASE_URL=https://staging.mastra.ai node run-all-tests.js --skip-server-start
`);
    process.exit(0);
  }

  // Parse URL argument
  const urlIndex = args.findIndex((arg) => arg === "--url");
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    process.env.TEST_BASE_URL = args[urlIndex + 1];
  }

  // Parse skip server start
  if (args.includes("--skip-server-start")) {
    process.env.SKIP_SERVER_START = "true";
  }

  runAllTests().catch((error) => {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  });
}
