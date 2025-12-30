import path from "path";
import fs from "fs/promises";

interface ValidationResult {
  file: string;
  error: "missing" | "invalid";
  details?: string;
}

interface FrontMatter {
  packages?: unknown;
  [key: string]: unknown;
}

// Paths where packages frontmatter is OPTIONAL (skipped from validation)
const SKIP_PATHS = [
  "guides/",
  "docs/community/",
  "docs/getting-started/",
  "docs/mastra-cloud/",
  "docs/index.mdx",
  "models/",
];

// Regex pattern for valid package names
const PACKAGE_PATTERN = /^@mastra\/[\w-]+$/;

function extractFrontMatter(content: string): FrontMatter | null {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return null;

  const frontMatterStr = match[1];
  const result: FrontMatter = {};

  // Parse YAML-like frontmatter
  const lines = frontMatterStr.split("\n");
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    // Check for array item (starts with "  - ")
    if (inArray && line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, "");
      currentArray.push(value);
      continue;
    }

    // If we were in an array and hit a non-array line, save the array
    if (inArray && currentKey) {
      result[currentKey] = currentArray;
      inArray = false;
      currentArray = [];
      currentKey = null;
    }

    // Check for key: value or key: (start of array)
    const keyMatch = line.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      if (value.trim() === "" || value.trim() === "|") {
        // This might be the start of an array or multiline value
        currentKey = key;
        inArray = true;
        currentArray = [];
      } else if (value.trim().startsWith("[") && value.trim().endsWith("]")) {
        // Inline array format: packages: ["@mastra/core", "@mastra/memory"]
        const arrayContent = value.trim().slice(1, -1);
        if (arrayContent.trim() === "") {
          result[key] = [];
        } else {
          result[key] = arrayContent
            .split(",")
            .map((item) => item.trim().replace(/^["']|["']$/g, ""));
        }
      } else {
        result[key] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  // Handle trailing array
  if (inArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

function requiresPackages(relativePath: string): boolean {
  // Check if path should be skipped (packages is optional for these paths)
  for (const skipPath of SKIP_PATHS) {
    if (relativePath.startsWith(skipPath) || relativePath === skipPath) {
      return false;
    }
  }

  // All other MDX files require packages frontmatter
  return true;
}

function validatePackagesField(packages: unknown): { valid: boolean; details?: string } {
  if (packages === undefined) {
    return { valid: false, details: "packages field is missing" };
  }

  if (!Array.isArray(packages)) {
    return { valid: false, details: "packages must be an array" };
  }

  if (packages.length === 0) {
    return { valid: false, details: "packages array must not be empty" };
  }

  for (const pkg of packages) {
    if (typeof pkg !== "string") {
      return { valid: false, details: `packages must contain strings, found: ${typeof pkg}` };
    }
    if (!PACKAGE_PATTERN.test(pkg)) {
      return { valid: false, details: `invalid package name: "${pkg}" (must match @mastra/*)` };
    }
  }

  return { valid: true };
}

async function validateMDXFiles(sourceDir: string): Promise<{
  errors: ValidationResult[];
  passed: number;
  total: number;
}> {
  const errors: ValidationResult[] = [];
  let passed = 0;
  let total = 0;

  async function processDirectory(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await processDirectory(fullPath);
        }
        continue;
      }

      // Only process .mdx files
      if (!entry.name.endsWith(".mdx")) continue;

      const relativePath = path.relative(sourceDir, fullPath).replaceAll("\\", "/");

      // Skip files that don't require packages frontmatter
      if (!requiresPackages(relativePath)) {
        continue;
      }

      total++;

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const frontMatter = extractFrontMatter(content);

        if (!frontMatter) {
          errors.push({
            file: relativePath,
            error: "missing",
            details: "no frontmatter found",
          });
          continue;
        }

        const validation = validatePackagesField(frontMatter.packages);

        if (!validation.valid) {
          if (frontMatter.packages === undefined) {
            errors.push({
              file: relativePath,
              error: "missing",
            });
          } else {
            errors.push({
              file: relativePath,
              error: "invalid",
              details: validation.details,
            });
          }
        } else {
          passed++;
        }
      } catch (error) {
        console.error(
          `Error processing file ${fullPath}: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }

  await processDirectory(sourceDir);

  return { errors, passed, total };
}

async function main() {
  console.log("Validating MDX frontmatter...\n");

  const sourceDir = path.join(process.cwd(), "src/content/en");

  try {
    await fs.stat(sourceDir);
  } catch {
    console.error(`Error: Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const { errors, passed, total } = await validateMDXFiles(sourceDir);

  const missingErrors = errors.filter((e) => e.error === "missing");
  const invalidErrors = errors.filter((e) => e.error === "invalid");

  if (missingErrors.length > 0) {
    console.log("❌ Missing 'packages' field:");
    for (const error of missingErrors) {
      console.log(`  - ${error.file}${error.details ? ` (${error.details})` : ""}`);
    }
    console.log();
  }

  if (invalidErrors.length > 0) {
    console.log("❌ Invalid 'packages' value:");
    for (const error of invalidErrors) {
      console.log(`  - ${error.file}${error.details ? ` (${error.details})` : ""}`);
    }
    console.log();
  }

  if (errors.length === 0) {
    console.log(`✅ All ${total} files passed validation`);
    process.exit(0);
  } else {
    console.log(`✅ ${passed} files passed validation`);
    console.log(`❌ ${errors.length} files failed validation`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error instanceof Error ? error.message : error);
  process.exit(1);
});

