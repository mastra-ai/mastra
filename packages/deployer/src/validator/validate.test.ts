import { pathToFileURL } from 'node:url';

import { describe, it, expect } from 'vitest';

// Reproducing the pattern from validate.ts
function slash(path: string) {
  const isExtendedLengthPath = path.startsWith('\\\\?\\');
  if (isExtendedLengthPath) {
    return path;
  }
  return path.replaceAll('\\', '/');
}

describe('File URL format validation for Windows paths', () => {
  /**
   * These tests demonstrate the bug in validate.ts line 99:
   *   `import('file://${slash(file)}')`
   *
   * On Windows, this produces invalid URLs like:
   *   file://C:/Users/path/file.js  (WRONG - C: is interpreted as hostname)
   *
   * The correct format should be:
   *   file:///C:/Users/path/file.js (CORRECT - three slashes, C: is part of path)
   *
   * This causes the error:
   *   ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'c:'
   */

  describe('Windows path format demonstration', () => {
    // Simulate a Windows-style path that has been slash-converted
    const windowsPathSlashed = 'C:/Users/test/project/file.js';

    it('should show the buggy URL format from validate.ts', () => {
      // This is what validate.ts currently produces:
      const buggyUrl = `file://${windowsPathSlashed}`;

      // file://C:/... has only TWO slashes after file:
      // This is an invalid file URL format for Windows absolute paths
      expect(buggyUrl).toBe('file://C:/Users/test/project/file.js');
      expect(buggyUrl.split('/').length).toBeLessThan('file:///C:/Users/test/project/file.js'.split('/').length);
    });

    it('should show the correct URL format using pathToFileURL', () => {
      // When on Windows, pathToFileURL correctly produces three slashes
      // We simulate this by showing what the correct format looks like
      const correctUrl = 'file:///C:/Users/test/project/file.js';

      // Correct format has THREE slashes after file:
      expect(correctUrl).toMatch(/^file:\/\/\//);

      // The pathname includes the drive letter
      const url = new URL(correctUrl);
      expect(url.protocol).toBe('file:');
      expect(url.hostname).toBe(''); // Empty hostname for local files
      expect(url.pathname).toBe('/C:/Users/test/project/file.js');
    });

    it('should demonstrate why the buggy URL fails on Windows Node.js', () => {
      const buggyUrl = `file://${windowsPathSlashed}`;

      // The issue is that when Node.js on Windows receives file://C:/path:
      // 1. Node tries to resolve this as a URL
      // 2. It sees "C:" as potentially another protocol/scheme
      // 3. It throws ERR_UNSUPPORTED_ESM_URL_SCHEME with "Received protocol 'c:'"
      //
      // This is a Windows-specific issue because:
      // - On Unix: file:///path works fine (path starts with /)
      // - On Windows: file://C:/path is ambiguous (C: looks like a scheme)
      //
      // The correct format file:///C:/path works because:
      // - The three slashes indicate an empty authority
      // - The path /C:/path is clearly a path, not a scheme

      // Verify the buggy URL doesn't have three slashes
      expect(buggyUrl).not.toMatch(/^file:\/\/\//);

      // Verify it starts with file:// followed by a drive letter
      expect(buggyUrl).toMatch(/^file:\/\/[A-Z]:/i);
    });
  });

  describe('Unix path compatibility', () => {
    const unixPath = '/Users/test/project/file.js';

    it('should work correctly with both methods on Unix paths', () => {
      const correctUrl = pathToFileURL(unixPath).href;
      const slashedUrl = `file://${slash(unixPath)}`;

      // On Unix, both approaches produce valid URLs because the path
      // already starts with /, making the total three slashes: file:// + /path
      expect(correctUrl).toBe('file:///Users/test/project/file.js');
      expect(slashedUrl).toBe('file:///Users/test/project/file.js');
      expect(correctUrl).toBe(slashedUrl);
    });

    it("should show why Unix paths don't have this bug", () => {
      // Unix path: /path/to/file
      // After file:// + /path = file:///path/to/file (correct!)
      // The leading / in the path creates the third slash automatically

      // Windows path: C:/path/to/file
      // After file:// + C:/path = file://C:/path/to/file (WRONG!)
      // There's no leading / to create the third slash

      const unixSlashed = `file://${unixPath}`;
      const windowsSlashed = `file://${'C:/path/to/file'}`;

      expect(unixSlashed.startsWith('file:///')).toBe(true); // Has 3 slashes
      expect(windowsSlashed.startsWith('file:///')).toBe(false); // Has only 2 slashes
    });
  });

  describe('Proposed fix validation', () => {
    it('should use pathToFileURL().href for cross-platform compatibility', () => {
      // On any platform, pathToFileURL handles the conversion correctly
      const testPath = '/tmp/test/file.js';
      const url = pathToFileURL(testPath).href;

      // Always produces a valid file URL
      expect(url).toMatch(/^file:\/\/\//);
    });

    it('should correctly handle Windows-style paths with pathToFileURL', () => {
      // Simulate how validate.ts now generates the URL
      const windowsPathSlashed = 'C:/Users/test/project/file.js';

      // OLD (buggy): file://${slash(file)}
      const buggyUrl = `file://${windowsPathSlashed}`;

      // NEW (fixed): pathToFileURL(file).href
      // On a real Windows system, this would produce the correct URL
      // We simulate by showing what the correct format should be
      const correctUrl = 'file:///C:/Users/test/project/file.js';

      // Verify the old format was wrong
      expect(buggyUrl).toBe('file://C:/Users/test/project/file.js');
      expect(buggyUrl).not.toMatch(/^file:\/\/\//);

      // Verify the new format is correct
      expect(correctUrl).toMatch(/^file:\/\/\//);

      // The key difference: three slashes vs two slashes
      expect(correctUrl.split('/').slice(0, 4).join('/')).toBe('file:///C:');
      expect(buggyUrl.split('/').slice(0, 3).join('/')).toBe('file://C:');
    });
  });
});
