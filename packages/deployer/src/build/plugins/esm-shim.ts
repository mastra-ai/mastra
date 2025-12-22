import originalEsmShim from '@rollup/plugin-esm-shim';
import type { Plugin } from 'rollup';

// Regex to detect DECLARATIONS of __filename, __dirname
// Using non-capturing group (?:) for slightly better performance
const FilenameDeclarationRegex = /(?:const|let|var)\s+__filename/;
const DirnameDeclarationRegex = /(?:const|let|var)\s+__dirname/;

/**
 * Custom ESM shim plugin wrapper that respects user-declared __filename/__dirname variables.
 *
 * The original @rollup/plugin-esm-shim would inject shims even when users had already declared
 * their own __filename/__dirname, causing "Identifier '__filename' has already been declared" errors.
 *
 * This wrapper checks if the user has already declared these variables and skips the shim injection
 * if so. If either variable is declared, we skip the shim entirely since the original plugin injects
 * both together and we assume users who declare one will also handle the other if needed.
 */
export function esmShim(): Plugin {
  const original = originalEsmShim();

  return {
    name: 'esm-shim',
    renderChunk(code, chunk, opts, meta) {
      // Fast path: use includes() first to avoid regex if identifiers aren't present
      const hasFilename = code.includes('__filename');
      const hasDirname = code.includes('__dirname');

      // If user declared either __filename or __dirname, skip shim injection entirely
      // since the original plugin injects both together
      const userDeclaredFilename = hasFilename && FilenameDeclarationRegex.test(code);
      const userDeclaredDirname = hasDirname && DirnameDeclarationRegex.test(code);

      if (userDeclaredFilename || userDeclaredDirname) {
        return null;
      }

      // Otherwise, delegate to the original plugin
      if (typeof original.renderChunk === 'function') {
        return original.renderChunk.call(this, code, chunk, opts, meta);
      }

      return null;
    },
  };
}

export default esmShim;
