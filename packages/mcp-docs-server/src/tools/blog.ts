import { z } from 'zod';
import { logger } from '../logger';
import { blogPostSchema } from '../utils';

const BLOG_BASE_URL = process.env.BLOG_URL || 'https://mastra.ai';

// Helper function to fetch blog posts as markdown
async function fetchBlogPosts(): Promise<string> {
  void logger.debug('Fetching list of blog posts');
  const response = await fetch(`${BLOG_BASE_URL}/api/blog`);
  if (!response.ok) {
    throw new Error('Failed to fetch blog posts');
  }
  const blogData = await response.json();

  const blogPosts = blogPostSchema.array().safeParse(blogData);

  if (!blogPosts.success) {
    return 'Failed to parse blog posts';
  }

  const blogLinks = blogPosts.data
    .map(post => {
      const title = post.metadata.title;
      const href = post.slug;
      if (title && href) {
        return `[${title}](${BLOG_BASE_URL}/blog/${href}) | [Markdown URL](${BLOG_BASE_URL}/api/blog/${href})`;
      }
      return null;
    })
    .filter(Boolean);

  return 'Mastra.ai Blog Posts:\n\n' + blogLinks.join('\n');
}

// Helper function to validate URL against allowed domain
function validateBlogUrl(url: string): boolean {
  try {
    const inputUrl = new URL(url);
    const baseUrl = new URL(BLOG_BASE_URL);

    // Check if the hostname matches exactly
    return inputUrl.hostname === baseUrl.hostname;
  } catch {
    // Invalid URL format
    return false;
  }
}

// Helper function to fetch a single blog post as markdown
async function fetchBlogPost(url: string): Promise<string> {
  void logger.debug(`Fetching blog post: ${url}`);

  // Validate URL before making the request
  if (!validateBlogUrl(url)) {
    void logger.error(`Rejected request to unauthorized domain: ${url}`);
    return `URL must be from the same domain as ${BLOG_BASE_URL}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    let blogList: string;
    try {
      const blogPosts = await fetchBlogPosts();
      blogList = `Here are available blog posts:\n\n${blogPosts}`;
    } catch (e) {
      void logger.error(
        `Blog post not found or failed to fetch: ${url}, and failed to fetch blog post listing as fallback.`,
        e,
      );
      blogList = 'Additionally, the list of available blog posts could not be fetched at this time.';
    }
    return `The requested blog post could not be found or fetched: ${url}\n\n${blogList}`;
  }
  const blogData = await response.json();

  const blogPost = blogPostSchema.safeParse(blogData);

  if (!blogPost.success) {
    return 'Failed to parse blog post';
  }

  // Get the main content
  const content = blogPost.data.content;
  if (!content) {
    throw new Error('No content found in blog post');
  }

  return content;
}

export const blogInputSchema = z.object({
  url: z
    .string()
    .describe(
      'URL of a specific blog post to fetch. If the string /api/blog is passed as the url it returns a list of all blog posts. The markdownUrl is the URL of a single blog post which can be used to fetch the blog post content in markdown format.',
    ),
});

export type BlogInput = z.infer<typeof blogInputSchema>;

export const blogTool = {
  name: 'mastraBlog',
  description:
    'Get Mastra.ai blog content. Without a URL, returns a list of all blog posts. With a URL, returns the specific blog post content in markdown format. The blog contains changelog posts as well as announcements and posts about Mastra features and AI news',
  parameters: blogInputSchema,
  execute: async (args: BlogInput) => {
    void logger.debug('Executing mastraBlog tool', { url: args.url });
    try {
      let content: string;
      if (args.url.trim() !== `/api/blog`) {
        content = await fetchBlogPost(args.url);
      } else {
        content = await fetchBlogPosts();
      }
      return content;
    } catch (error) {
      void logger.error('Failed to execute mastraBlog tool', error);
      throw error;
    }
  },
};
