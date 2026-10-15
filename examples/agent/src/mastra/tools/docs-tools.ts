import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Searches and reads the repo's own docs (docs/src/content/en) instead of the live site,
// so the agent works offline and answers match the checked-out version.

type DocPage = { path: string; url: string; title: string; content: string };

let cache: DocPage[] | undefined;

function findDocsRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    const candidate = resolve(dir, 'docs/src/content/en');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Could not find docs/src/content/en above the current directory');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

function loadPages(): DocPage[] {
  if (cache) return cache;
  const root = findDocsRoot();
  cache = ['docs', 'reference'].flatMap(section =>
    walk(join(root, section)).map(file => {
      const content = readFileSync(file, 'utf8');
      const path = relative(root, file).replace(/\.mdx$/, '').replace(/\/index$/, '');
      const title = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)?.[1] ?? path;
      return { path, url: `https://mastra.ai/${path}`, title, content };
    }),
  );
  return cache;
}

export const searchDocs = createTool({
  id: 'searchDocs',
  description: 'Search the Mastra documentation index by a few topic keywords. Returns matching page paths.',
  inputSchema: z.object({
    query: z.string().min(1).describe('A few focused topic keywords, not a full sentence'),
  }),
  execute: async ({ query }) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = loadPages()
      .map(page => {
        const title = page.title.toLowerCase();
        const path = page.path.toLowerCase();
        const body = page.content.toLowerCase();
        const score = terms.reduce(
          (sum, t) => sum + (title.includes(t) ? 5 : 0) + (path.includes(t) ? 3 : 0) + Math.min(body.split(t).length - 1, 5),
          0,
        );
        return { path: page.path, url: page.url, title: page.title, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return { results };
  },
});

export const readDocs = createTool({
  id: 'readDocs',
  description: 'Read one or more Mastra documentation pages by the paths returned from searchDocs.',
  inputSchema: z.object({
    paths: z.array(z.string()).min(1).max(3),
  }),
  execute: async ({ paths }) => {
    const pages = loadPages();
    return {
      pages: paths.map(path => {
        const page = pages.find(p => p.path === path.replace(/^\/+|\/+$/g, ''));
        return page
          ? { path: page.path, url: page.url, title: page.title, content: page.content.slice(0, 12_000) }
          : { path, error: 'Page not found' };
      }),
    };
  },
});
