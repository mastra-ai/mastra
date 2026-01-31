#!/usr/bin/env node

/**
 * Script to update Mastra package install commands in the documentation. You can configure the search and replace npm tags.
 *
 * Reads package names from .changeset/pre.json and replaces occurrences of
 * `[package-name]@[TAG_FROM]` with `[package-name]@[TAG_TO]` in all .mdx files under the configured directory to search.
 *
 * Usage: node scripts/update-install-commands.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const TAG_FROM = "beta";
const TAG_TO = "latest";
const DIR_TO_SEARCH = path.join(rootDir, "docs", "src", "content");

/**
 * Recursively find all .mdx files in a directory
 */
function findMdxFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMdxFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  // 1. Read pre.json and extract package names
  const preJsonPath = path.join(rootDir, ".changeset", "pre.json");
  const preJson = JSON.parse(fs.readFileSync(preJsonPath, "utf8"));

  const packageNames = Object.keys(preJson.initialVersions).filter(
    (name) => !name.startsWith("@internal/"),
  );

  console.log(
    `Found ${packageNames.length} packages to check for @${TAG_FROM}`,
  );

  // 2. Find all .mdx content files
  const files = findMdxFiles(DIR_TO_SEARCH);
  console.log(`Found ${files.length} .mdx files to process`);

  let totalFilesModified = 0;
  let totalReplacements = 0;

  // 3. For each file, replace all occurrences
  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    let modified = false;
    let fileReplacements = 0;

    for (const pkg of packageNames) {
      const searchPattern = `${pkg}@${TAG_FROM}`;
      if (content.includes(searchPattern)) {
        const count = (
          content.match(new RegExp(escapeRegex(searchPattern), "g")) || []
        ).length;
        content = content.replaceAll(searchPattern, `${pkg}@${TAG_TO}`);
        modified = true;
        fileReplacements += count;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content);
      const relativeFile = path.relative(rootDir, file);
      console.log(
        `Updated: ${relativeFile} (${fileReplacements} replacements)`,
      );
      totalFilesModified++;
      totalReplacements += fileReplacements;
    }
  }

  console.log(
    `\nDone! Modified ${totalFilesModified} files with ${totalReplacements} total replacements.`,
  );
}

main();
