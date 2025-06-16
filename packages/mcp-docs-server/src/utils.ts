import { spawn } from 'child_process';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { rgPath } from '@vscode/ripgrep';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function fromRepoRoot(relative: string) {
  return path.resolve(__dirname, `../../../`, relative);
}
export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../`, relative);
}

// can't use console.log() because it writes to stdout which will interfere with the MCP Stdio protocol
export const log = console.error;

async function searchDocumentContent(keywords: string[], baseDir: string): Promise<string[]> {
  if (keywords.length === 0) return [];

  // Create a pattern that matches any of our keywords
  const keywordPattern = keywords.join('|');

  const args = ['--json', '--glob', '*.mdx', '--ignore-case', '--line-number', keywordPattern, baseDir];

  const grepResults = await runRipgrep(args);

  // Score each file based on keyword matches
  const fileScores = new Map<string, FileScore>();

  for (const match of grepResults.matches || []) {
    if (!match.file) continue;

    // Use path.relative for cross-platform path handling
    const relativePath = path.relative(baseDir, match.file).replace(/\\/g, '/'); // Normalize to forward slashes

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

    // Check which keywords this line contains
    const lineText = match.text?.toLowerCase() || '';
    keywords.forEach(keyword => {
      if (lineText.includes(keyword.toLowerCase())) {
        score.keywordMatches.add(keyword);
        score.totalMatches++;

        // Boost score if keyword appears in headers
        if (lineText.includes('#') || lineText.includes('title')) {
          score.titleMatches++;
        }
      }
    });
  }

  // Filter to only files that contain ALL keywords, then rank
  const validFiles = Array.from(fileScores.values())
    .sort((a, b) => calculateFinalScore(b, keywords.length) - calculateFinalScore(a, keywords.length))
    .slice(0, 10); // Limit to top 5 results

  return validFiles.map(score => score.path);
}

async function runRipgrep(args: string[]): Promise<{ matches: Array<{ file: string; text: string; line: number }> }> {
  return new Promise((resolve, reject) => {
    const rg = spawn(rgPath, args);
    let output = '';
    let errorOutput = '';

    rg.stdout.on('data', data => {
      output += data.toString();
    });

    rg.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    rg.on('close', code => {
      if (code !== 0 && code !== 1) {
        // 1 is "no matches found", which is ok
        reject(new Error(`Ripgrep failed: ${errorOutput}`));
        return;
      }

      const matches = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'match') {
              return {
                file: parsed.data.path.text,
                line: parsed.data.line_number,
                text: parsed.data.lines.text,
              };
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      resolve({ matches: matches as Array<{ file: string; text: string; line: number }> });
    });

    rg.on('error', err => {
      reject(err);
    });
  });
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
