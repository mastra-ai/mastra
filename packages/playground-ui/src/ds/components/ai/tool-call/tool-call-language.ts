const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
};

export function languageForPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const extension = path.split('.').pop()?.toLowerCase();
  return extension ? EXTENSION_LANGUAGES[extension] : undefined;
}
