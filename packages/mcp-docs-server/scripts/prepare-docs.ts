import fs from 'node:fs/promises';
import path from 'node:path';
import { fromPackageRoot, fromRepoRoot, log } from '../src/utils';

const BUILD_DIR = fromRepoRoot('docs/build');
const COURSE_SOURCE = fromRepoRoot('docs/src/course');
const DOCS_DEST = fromPackageRoot('.docs');
const COURSE_DEST = path.join(DOCS_DEST, 'course');

// Top-level categories that should keep their index.md files
const TOP_LEVEL_CATEGORIES = ['docs', 'guides', 'models', 'reference'];

// Walk directory and find all llms.txt files
async function* walkLlmsTxtFiles(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkLlmsTxtFiles(fullPath);
    } else if (entry.isFile() && entry.name === 'llms.txt') {
      yield fullPath;
    }
  }
}

// Copy a directory recursively (for course content which uses .md files directly)
async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Converts a source path like "docs/agents/adding-voice/llms.txt" to the destination path.
 *
 * Rules:
 * - Top-level category index files stay as index.md (e.g., docs/llms.txt -> docs/index.md)
 * - Other files become folder-name.md (e.g., docs/agents/adding-voice/llms.txt -> docs/agents/adding-voice.md)
 */
function getDestinationPath(relativePath: string): string {
  // Remove llms.txt from the path to get the folder path
  const folderPath = path.dirname(relativePath);
  const parts = folderPath.split(path.sep);

  // If this is a top-level category (e.g., "docs" or "reference"), keep as index.md
  if (parts.length === 1 && TOP_LEVEL_CATEGORIES.includes(parts[0]!)) {
    return path.join(folderPath, 'index.md');
  }

  // Otherwise, convert folder/index.md to folder.md
  // e.g., docs/agents/adding-voice -> docs/agents/adding-voice.md
  const parentDir = path.dirname(folderPath);
  const folderName = path.basename(folderPath);
  return path.join(parentDir, `${folderName}.md`);
}

async function copyLlmsTxtFiles() {
  log('Scanning build directory for llms.txt files...');

  // Clean up existing .docs directory
  try {
    await fs.rm(DOCS_DEST, { recursive: true });
    log('Cleaned up existing .docs directory');
  } catch {
    // Ignore if directory doesn't exist
  }

  // Create destination directory
  await fs.mkdir(DOCS_DEST, { recursive: true });

  let copiedCount = 0;
  const errors: string[] = [];

  // Walk the build directory and copy all llms.txt files
  for await (const sourcePath of walkLlmsTxtFiles(BUILD_DIR)) {
    // Get relative path from build dir (e.g., docs/agents/overview/llms.txt)
    const relativePath = path.relative(BUILD_DIR, sourcePath);

    // Convert to destination path based on the rules
    const destRelativePath = getDestinationPath(relativePath);
    const destPath = path.join(DOCS_DEST, destRelativePath);

    try {
      // Create destination directory
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Copy the llms.txt file as .md
      await fs.copyFile(sourcePath, destPath);
      copiedCount++;
    } catch (error) {
      const errorMsg = `Failed to copy ${relativePath}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      log(`⚠️ ${errorMsg}`);
    }
  }

  log(`✅ Copied ${copiedCount} documentation files as .md`);
  if (errors.length > 0) {
    log(`⚠️ ${errors.length} files failed to copy`);
  }
}

async function copyCourseContent() {
  log('Copying course content...');

  try {
    // Check if course source exists
    await fs.access(COURSE_SOURCE);

    // Copy course content (these are raw .md files, not llms.txt)
    await copyDir(COURSE_SOURCE, COURSE_DEST);
    log('✅ Course content copied');
  } catch {
    log('⚠️ Course content not found, skipping');
  }
}

export async function prepare() {
  log('Preparing documentation...');
  await copyLlmsTxtFiles();
  await copyCourseContent();
  log('Documentation preparation complete!');
}

try {
  await prepare();
} catch (error) {
  console.error('Error preparing documentation:', error);
  process.exit(1);
}
