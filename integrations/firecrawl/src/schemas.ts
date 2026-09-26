import type { Document } from 'firecrawl';
import { z } from 'zod';

export const scrapeFormatSchema = z.enum(['markdown', 'html', 'rawHtml', 'links', 'summary']);

export type ScrapeFormat = z.infer<typeof scrapeFormatSchema>;

/** Page content shared by scrape results and search results scraped inline. */
export const documentSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  statusCode: z.number().optional(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  rawHtml: z.string().optional(),
  links: z.array(z.string()).optional(),
  summary: z.string().optional(),
  warning: z.string().optional(),
});

export type DocumentOutput = z.infer<typeof documentSchema>;

export function toDocumentOutput(doc: Document): DocumentOutput {
  const metadata = doc.metadata ?? {};

  return {
    url: metadata.sourceURL ?? metadata.url,
    title: metadata.title,
    description: metadata.description,
    statusCode: metadata.statusCode,
    markdown: doc.markdown,
    html: doc.html,
    rawHtml: doc.rawHtml,
    links: doc.links,
    summary: doc.summary,
    warning: doc.warning,
  };
}
