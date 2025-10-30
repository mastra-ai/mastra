#!/usr/bin/env node

/**
 * This script checks if deleted MDX files have corresponding redirects in vercel.json
 * It compares the current branch with the base branch (usually main)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE_REF = process.env.BASE_REF || "origin/main";
const DOCS_DIR = "docs/src/content";
const VERCEL_JSON_PATH = "docs/vercel.json";

// Get list of deleted MDX files
function getDeletedMdxFiles() {
  try {
    const diff = execSync(
      `git diff --name-status ${BASE_REF}...HEAD -- ${DOCS_DIR}`,
      {
        encoding: "utf-8",
      },
    );

    const deletedFiles = diff
      .split("\n")
      .filter((line) => line.startsWith("D\t") && line.endsWith(".mdx"))
      .map((line) => line.replace("D\t", "").trim());

    return deletedFiles;
  } catch (error) {
    console.error("Error getting deleted files:", error.message);
    return [];
  }
}

// Convert file path to URL path
function filePathToUrlPath(filePath) {
  // Remove docs/src/content/en/ prefix and .mdx suffix
  let urlPath = filePath
    .replace(/^docs\/src\/content\/en\//, "")
    .replace(/\.mdx$/, "");

  // Handle index files (they should redirect to parent directory)
  if (urlPath.endsWith("/index")) {
    urlPath = urlPath.replace(/\/index$/, "");
  }

  // Add leading slash
  urlPath = "/" + urlPath;

  return urlPath;
}

// Load redirects from vercel.json
function getExistingRedirects() {
  try {
    const vercelJson = JSON.parse(fs.readFileSync(VERCEL_JSON_PATH, "utf-8"));
    return vercelJson.redirects || [];
  } catch (error) {
    console.error("Error reading vercel.json:", error.message);
    return [];
  }
}

// Check if a URL has a redirect
function hasRedirect(urlPath, redirects) {
  return redirects.some((redirect) => {
    const source = redirect.source;

    // Exact match
    if (source === urlPath) {
      return true;
    }

    // Check if source is a pattern that would match this path
    // Handle wildcards like /path/:slug or /path/*
    const pattern = source
      .replace(/:[^/]+/g, "[^/]+") // :param becomes regex
      .replace(/\*/g, ".*"); // * becomes .*

    try {
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(urlPath);
    } catch {
      return false;
    }
  });
}

// Main function
function main() {
  console.log("🔍 Checking for removed pages without redirects...\n");

  const deletedFiles = getDeletedMdxFiles();

  if (deletedFiles.length === 0) {
    console.log("✅ No MDX files were deleted in this PR.");
    process.exit(0);
  }

  console.log(`Found ${deletedFiles.length} deleted MDX file(s):\n`);
  deletedFiles.forEach((file) => console.log(`  - ${file}`));
  console.log("");

  const redirects = getExistingRedirects();
  console.log(`Found ${redirects.length} redirects in vercel.json\n`);

  const missingRedirects = [];

  for (const filePath of deletedFiles) {
    const urlPath = filePathToUrlPath(filePath);

    if (!hasRedirect(urlPath, redirects)) {
      missingRedirects.push({ filePath, urlPath });
    }
  }

  if (missingRedirects.length === 0) {
    console.log("✅ All deleted pages have redirects!");
    process.exit(0);
  }

  console.log("❌ Missing redirects for the following pages:\n");
  missingRedirects.forEach(({ filePath, urlPath }) => {
    console.log(`  File: ${filePath}`);
    console.log(`  URL:  ${urlPath}`);
    console.log("");
  });

  console.log("Please add redirects for these pages in docs/vercel.json\n");
  console.log("Example redirect:");
  console.log(
    JSON.stringify(
      {
        source: missingRedirects[0].urlPath,
        destination: "/docs", // Update with appropriate destination
        permanent: true,
      },
      null,
      2,
    ),
  );

  // Save missing redirects for GitHub Action to use
  const output = missingRedirects.map((m) => m.urlPath);
  fs.writeFileSync(
    "/tmp/missing-redirects.json",
    JSON.stringify(output, null, 2),
  );

  process.exit(1);
}

main();
