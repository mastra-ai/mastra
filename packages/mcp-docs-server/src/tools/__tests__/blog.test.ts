import { describe, expect, test, vi } from 'vitest';
import { blogTool } from '../blog';
import fs from 'fs';
import path from 'path';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('blog tool', () => {
  test('fetches and parses blog posts correctly', async () => {
    const fixture = fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-list-raw.txt'), 'utf-8');

    mockFetch.mockResolvedValueOnce({
      text: () => Promise.resolve(fixture),
    });

    const result = await blogTool.execute({ url: '/blog' });
    expect(result).toContain('Mastra.ai Blog Posts:');
    expect(result).toContain(
      '[Announcing our new book: Principles of Building AI agents](/blog/principles-of-ai-engineering)',
    );
    expect(result).toContain('[AI Beats Laboratory: A Multi-Agent Music Generation System](/blog/ai-beats-lab)');
    expect(result).not.toContain('nav');
    expect(result).not.toContain('footer');
  });

  test('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(blogTool.execute({ url: '/blog' })).rejects.toThrow('Failed to fetch blog posts');
  });

  test('returns specific blog post content when URL is provided', async () => {
    const fixture = fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-post-raw.txt'), 'utf-8');

    mockFetch.mockResolvedValueOnce({
      text: () => Promise.resolve(fixture),
    });

    const result = await blogTool.execute({ url: '/blog/principles-of-ai-engineering' });
    expect(result).toContain('Announcing our new book: Principles of Building AI agents');
    expect(result).toContain('Principles of Building AI agents');
    expect(result).toContain("Today is YC demo day and we're excited to announce the release of our new book");
  });

  test('removes Next.js initialization code from blog post content', async () => {
    const mockContent = `
      <h1>Test Blog Post</h1>
      <p>This is a test blog post.</p>
      <script>(self.__next_f=self.__next_f||[]).push([0]);</script>
    `;

    mockFetch.mockResolvedValueOnce({
      text: () => Promise.resolve(mockContent),
    });

    const result = await blogTool.execute({ url: '/blog/test-post' });
    expect(result).toContain('Test Blog Post');
    expect(result).toContain('This is a test blog post.');
    expect(result).not.toContain('self.__next_f');
  });
});
