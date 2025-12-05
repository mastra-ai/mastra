import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');

interface DocConfig {
  src: string[];
  dest: string;
}

interface Config {
  [key: string]: DocConfig;
}

function removeMetadata(content: string): string {
  // Remove YAML frontmatter (content between --- markers at the start)
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n*/;
  return content.replace(frontmatterRegex, '');
}

function removeImports(content: string): string {
  // Remove import statements
  const importRegex = /^import\s+.*?(?:from\s+['"].*?['"])?;?\s*$/gm;
  return content
    .replace(importRegex, '')
    .replace(/^\s*\n/gm, '\n')
    .replace(/^\n+/, '');
}

function removeImages(content: string): string {
  // Remove ![alt](url) image links entirely
  const imageRegex = /!\[[^\]]*\]\([^)]+\)\n?/g;
  return content.replace(imageRegex, '');
}

function removeLinks(content: string): string {
  // Replace [text](url) with just text
  const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
  return content.replace(linkRegex, '$1');
}

function cleanContent(content: string): string {
  let cleaned = removeMetadata(content);
  cleaned = removeImports(cleaned);
  cleaned = removeImages(cleaned);
  cleaned = removeLinks(cleaned);
  return cleaned.trim();
}

async function generateLlmDocs() {
  const configPath = resolve(__dirname, '../llm-docs.js');
  const { config } = (await import(configPath)) as { config: Config };

  for (const [key, { src, dest }] of Object.entries(config)) {
    console.log(`Processing: ${key}`);

    const contents: string[] = [];

    for (const srcPath of src) {
      const absoluteSrcPath = resolve(rootDir, srcPath);
      console.log(`Reading: ${absoluteSrcPath}`);
      try {
        const content = await readFile(absoluteSrcPath, 'utf-8');
        const cleaned = cleanContent(content);
        contents.push(cleaned);
      } catch (error) {
        console.error(`Failed to read ${absoluteSrcPath}:`, error);
      }
    }

    if (contents.length > 0) {
      const combined = contents.join('\n\n---\n\n');
      const absoluteDestPath = resolve(rootDir, dest);

      await mkdir(dirname(absoluteDestPath), { recursive: true });
      await writeFile(absoluteDestPath, combined, 'utf-8');
      console.log(`Written: ${absoluteDestPath}`);
    }
  }
}

generateLlmDocs().catch(console.error);
