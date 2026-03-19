/**
 * Language Detection
 *
 * Maps file extensions to LSP language identifiers.
 * Browser-safe — no Node.js dependencies.
 */

/**
 * Maps file extensions (including the dot) to LSP language identifiers.
 */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  // TypeScript/JavaScript
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Python
  '.py': 'python',
  '.pyi': 'python',

  // Go
  '.go': 'go',

  // Rust
  '.rs': 'rust',

  // C/C++
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',

  // Java
  '.java': 'java',

  // JSON
  '.json': 'json',
  '.jsonc': 'jsonc',

  // YAML
  '.yaml': 'yaml',
  '.yml': 'yaml',

  // Markdown
  '.md': 'markdown',

  // HTML/CSS
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
};

/**
 * Get the LSP language ID for a file path based on its extension.
 * Returns undefined if the extension is not recognized.
 */
export function getLanguageId(filePath: string): string | undefined {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  const ext = filePath.substring(dotIndex);
  return LANGUAGE_EXTENSIONS[ext];
}
