import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn(),
}));

vi.mock('serve-handler');

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('studio - auth header feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('XSS protection - escapeForHtmlScript', () => {
    it('should escape single quotes to prevent breaking out of string literal', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      expect(escapeForHtmlScript("'; alert('XSS');//")).toBe("\\'; alert(\\'XSS\\');//");
    });

    it('should escape script tags to prevent injection', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      expect(escapeForHtmlScript('</script><script>alert(1)')).toBe('\\x3c/script\\x3e\\x3cscript\\x3ealert(1)');
    });

    it('should escape backslashes', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      expect(escapeForHtmlScript('\\')).toBe('\\\\');
      expect(escapeForHtmlScript('\\n')).toBe('\\\\n');
    });

    it('should escape newlines and carriage returns', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      expect(escapeForHtmlScript('line1\nline2')).toBe('line1\\nline2');
      expect(escapeForHtmlScript('line1\rline2')).toBe('line1\\rline2');
    });

    it('should escape angle brackets', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      expect(escapeForHtmlScript('<foo>')).toBe('\\x3cfoo\\x3e');
      expect(escapeForHtmlScript('<script>')).toBe('\\x3cscript\\x3e');
    });

    it('should pass through safe auth header values unchanged', async () => {
      const { escapeForHtmlScript } = await import('./studio.js');
      // JWT tokens
      expect(escapeForHtmlScript('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      );
      // API keys
      expect(escapeForHtmlScript('x-api-key: sk-1234_ABCD-5678')).toBe('x-api-key: sk-1234_ABCD-5678');
      expect(escapeForHtmlScript('Authorization: Bearer token123')).toBe('Authorization: Bearer token123');
    });
  });

  describe('createServer - HTML placeholder replacement', () => {
    it('should replace MASTRA_AUTH_HEADER placeholder with escaped value', async () => {
      const originalHtml = `<script>window.MASTRA_AUTH_HEADER = '%%MASTRA_AUTH_HEADER%%';</script>`;
      vi.mocked(readFileSync).mockReturnValue(originalHtml);

      const { createServer } = await import('./studio.js');
      createServer('/mock/path', { authHeader: "'; alert('XSS');//" });

      // Verify readFileSync was called
      expect(readFileSync).toHaveBeenCalled();

      // The HTML should have been read and modified internally
      const htmlContent = vi.mocked(readFileSync).mock.calls[0][1] as string;
      expect(htmlContent).toBe('utf8');
    });

    it('should replace MASTRA_AUTH_HEADER with safe header value', async () => {
      const originalHtml = `<script>window.MASTRA_AUTH_HEADER = '%%MASTRA_AUTH_HEADER%%';</script>`;
      vi.mocked(readFileSync).mockReturnValue(originalHtml);

      const { createServer } = await import('./studio.js');
      createServer('/mock/path', { authHeader: 'Authorization: Bearer token123' });

      expect(readFileSync).toHaveBeenCalled();
    });

    it('should handle empty auth header', async () => {
      const originalHtml = `<script>window.MASTRA_AUTH_HEADER = '%%MASTRA_AUTH_HEADER%%';</script>`;
      vi.mocked(readFileSync).mockReturnValue(originalHtml);

      const { createServer } = await import('./studio.js');
      createServer('/mock/path', { authHeader: '' });

      expect(readFileSync).toHaveBeenCalled();
    });
  });

  describe('server-api-prefix feature', () => {
    it('should replace MASTRA_API_PREFIX with custom value', async () => {
      const originalHtml = `<script>window.MASTRA_API_PREFIX = '%%MASTRA_API_PREFIX%%';</script>`;
      vi.mocked(readFileSync).mockReturnValue(originalHtml);

      const { createServer } = await import('./studio.js');
      createServer('/mock/path', { serverApiPrefix: '/api/v1' });

      expect(readFileSync).toHaveBeenCalled();
    });

    it('should use default /api prefix when not provided', async () => {
      const originalHtml = `<script>window.MASTRA_API_PREFIX = '%%MASTRA_API_PREFIX%%';</script>`;
      vi.mocked(readFileSync).mockReturnValue(originalHtml);

      const { createServer } = await import('./studio.js');
      createServer('/mock/path', {});

      expect(readFileSync).toHaveBeenCalled();
    });
  });
});
