import { JSDOM } from 'jsdom';
import { z } from 'zod';

// Helper function to fetch blog posts as markdown
async function fetchBlogPosts(): Promise<string> {
  try {
    const response = await fetch('https://mastra.ai/blog');
    if (!response.ok) {
      throw new Error('Failed to fetch blog posts');
    }
    const html = await response.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Find all blog post links
    const blogLinks = Array.from(document.querySelectorAll('a[href^="/blog/"]'))
      .filter(link => {
        const href = link.getAttribute('href');
        // Exclude the main blog page and any other special pages
        return href !== '/blog' && !href?.includes('authors');
      })
      .map(link => {
        const h2 = link.querySelector('h2');
        const title = h2?.textContent?.trim();
        const href = link.getAttribute('href');
        if (title && href) {
          return `[${title}](${href})`;
        }
        return null;
      })
      .filter(Boolean);

    return 'Mastra.ai Blog Posts:\n\n' + blogLinks.join('\n');
  } catch (error) {
    throw new Error('Failed to fetch blog posts ' + JSON.stringify(error));
  }
}

// Helper function to fetch and convert a blog post to markdown
async function fetchBlogPost(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch blog post');
    }
    const html = await response.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove Next.js initialization code
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Get the main content
    const content = document.body.textContent?.trim() || '';
    if (!content) {
      throw new Error('No content found in blog post');
    }

    return content;
  } catch (error) {
    throw new Error(`Failed to fetch blog post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const blogTool = {
  name: 'mastraBlog',
  description:
    'Get Mastra.ai blog content. Without a URL, returns a list of all blog posts. With a URL, returns the specific blog post content in markdown format. The blog contains changelog posts as well as announcements and posts about Mastra features and AI news',
  parameters: z.object({
    url: z
      .string()
      .describe(
        'URL of a specific blog post to fetch. If the string /blog is passed as the url it returns a list of all blog posts.',
      ),
  }),
  execute: async (args: { url: string }) => {
    try {
      if (args.url !== `/blog`) {
        return await fetchBlogPost(`https://mastra.ai${args.url}`);
      } else {
        return await fetchBlogPosts();
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error('Failed to fetch blog posts');
      }
      throw error;
    }
  },
};
