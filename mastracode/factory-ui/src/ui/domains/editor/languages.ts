import type { LanguageSupport } from '@codemirror/language';

/**
 * Resolve a CodeMirror language for a workspace file path.
 *
 * We ship the popular languages statically (small enough) and fall back to a
 * plain-text buffer for everything else. The map is intentionally
 * extension-driven — MIME sniffing on the browser side is unreliable, and the
 * server already exposes text file content only.
 *
 * Returns full `LanguageSupport` (not just an `Extension`) so callers outside
 * the editor — search previews, hover code blocks — can reach the parser for
 * standalone syntax highlighting.
 */

const EXTENSION_LOADERS: Record<string, () => Promise<LanguageSupport>> = {
  ts: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: false }),
  tsx: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: true }),
  js: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: false, jsx: false }),
  jsx: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: false, jsx: true }),
  mjs: async () => (await import('@codemirror/lang-javascript')).javascript(),
  cjs: async () => (await import('@codemirror/lang-javascript')).javascript(),
  json: async () => (await import('@codemirror/lang-json')).json(),
  md: async () => (await import('@codemirror/lang-markdown')).markdown(),
  mdx: async () => (await import('@codemirror/lang-markdown')).markdown(),
  css: async () => (await import('@codemirror/lang-css')).css(),
  scss: async () => (await import('@codemirror/lang-css')).css(),
  html: async () => (await import('@codemirror/lang-html')).html(),
  htm: async () => (await import('@codemirror/lang-html')).html(),
  py: async () => (await import('@codemirror/lang-python')).python(),
  rs: async () => (await import('@codemirror/lang-rust')).rust(),
  go: async () => (await import('@codemirror/lang-go')).go(),
  sql: async () => (await import('@codemirror/lang-sql')).sql(),
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  yml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  xml: async () => (await import('@codemirror/lang-xml')).xml(),
};

// LanguageSupport instances are immutable — cache one per extension so the
// search panel highlighting hundreds of previews doesn't rebuild them.
const cache = new Map<string, Promise<LanguageSupport | null>>();

export async function loadLanguageSupport(filePath: string): Promise<LanguageSupport | null> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const loader = EXTENSION_LOADERS[ext];
  if (!loader) return null;
  const existing = cache.get(ext);
  if (existing) return existing;
  const pending = loader().catch(() => null);
  cache.set(ext, pending);
  return pending;
}

export function languageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return 'text';
  return ext;
}
