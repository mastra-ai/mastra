import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const mdxFileCache = new Map<string, string[]>();

const __dirname = dirname(fileURLToPath(import.meta.url));

export function fromRepoRoot(relative: string) {
  return path.resolve(__dirname, `../../../`, relative);
}
export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../`, relative);
}

// can't use console.log() because it writes to stdout which will interfere with the MCP Stdio protocol
export const log = console.error;

async function* walkMdxFiles(dir: string): AsyncGenerator<string> {
  if (mdxFileCache.has(dir)) {
    for (const file of mdxFileCache.get(dir)!) yield file;
    return;
  }
  const filesInDir: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // For directories, recurse and collect all files
      for await (const file of walkMdxFiles(fullPath)) {
        filesInDir.push(file);
        yield file;
      }
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      // For MDX files, add to collection and yield
      filesInDir.push(fullPath);
      yield fullPath;
    }
  }
  mdxFileCache.set(dir, filesInDir);
}

async function searchDocumentContent(keywords: string[], baseDir: string): Promise<string[]> {
  if (keywords.length === 0) return [];

  const fileScores = new Map<string, FileScore>();

  for await (const filePath of walkMdxFiles(baseDir)) {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    lines.forEach(lineText => {
      const lowerLine = lineText.toLowerCase();
      for (const keyword of keywords) {
        if (lowerLine.includes(keyword.toLowerCase())) {
          const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
          if (!fileScores.has(relativePath)) {
            fileScores.set(relativePath, {
              path: relativePath,
              keywordMatches: new Set(),
              totalMatches: 0,
              titleMatches: 0,
              pathRelevance: calculatePathRelevance(relativePath, keywords),
            });
          }
          const score = fileScores.get(relativePath)!;
          score.keywordMatches.add(keyword);
          score.totalMatches++;
          if (lowerLine.includes('#') || lowerLine.includes('title')) {
            score.titleMatches++;
          }
        }
      }
    });
  }

  // Filter to only files that contain ALL keywords, then rank
  const validFiles = Array.from(fileScores.values())
    .sort((a, b) => calculateFinalScore(b, keywords.length) - calculateFinalScore(a, keywords.length))
    .slice(0, 10); // Limit to top 10 results

  return validFiles.map(score => score.path);
}

interface FileScore {
  path: string;
  keywordMatches: Set<string>;
  totalMatches: number;
  titleMatches: number;
  pathRelevance: number;
}

function calculatePathRelevance(filePath: string, keywords: string[]): number {
  let relevance = 0;
  const pathLower = filePath.toLowerCase();

  // Boost for reference docs
  if (pathLower.startsWith('reference/')) relevance += 2;

  // Boost if path contains any keywords
  keywords.forEach(keyword => {
    if (pathLower.includes(keyword.toLowerCase())) relevance += 3;
  });

  // Boost for high-value directories
  const highValueDirs = ['rag', 'memory', 'agents', 'workflows'];
  if (highValueDirs.some(dir => pathLower.includes(dir))) {
    relevance += 1;
  }

  return relevance;
}

function calculateFinalScore(score: FileScore, totalKeywords: number): number {
  const allKeywordsBonus = score.keywordMatches.size === totalKeywords ? 10 : 0;
  return (
    score.totalMatches * 1 +
    score.titleMatches * 3 +
    score.pathRelevance * 2 +
    score.keywordMatches.size * 5 +
    allKeywordsBonus // All keywords bonus
  );
}

function extractKeywordsFromPath(path: string): string[] {
  // Get only the filename (last part of the path)
  const filename =
    path
      .split('/')
      .pop() // Get last segment
      ?.replace(/\.(mdx|md)$/, '') || ''; // Remove file extension

  const keywords = new Set<string>();

  // Split on hyphens, underscores, camelCase
  const splitParts = filename.split(/[-_]|(?=[A-Z])/);
  splitParts.forEach(keyword => {
    if (keyword.length > 2) {
      keywords.add(keyword.toLowerCase());
    }
  });

  return Array.from(keywords);
}

function normalizeKeywords(keywords: string[]): string[] {
  return Array.from(new Set(keywords.flatMap(k => k.split(/\s+/).filter(Boolean)).map(k => k.toLowerCase())));
}

export async function getMatchingPaths(path: string, queryKeywords: string[], baseDir: string): Promise<string> {
  const pathKeywords = extractKeywordsFromPath(path);
  const allKeywords = normalizeKeywords([...pathKeywords, ...(queryKeywords || [])]);

  if (allKeywords.length === 0) {
    return '';
  }

  const suggestedPaths = await searchDocumentContent(allKeywords, baseDir);
  if (suggestedPaths.length === 0) {
    return '';
  }

  const pathList = suggestedPaths.map(path => `- ${path}`).join('\n');
  return `Here are some paths that might be relevant based on your query:\n\n${pathList}`;
}
