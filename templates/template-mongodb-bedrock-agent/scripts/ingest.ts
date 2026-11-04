/**
 * Ingest the Mastra documentation into MongoDB Atlas Vector Search.
 *
 * Pipeline:  llms.txt index  ->  fetch each .md page  ->  chunk  ->  Bedrock Titan
 *            embeddings  ->  upsert into Atlas Vector Search (with source metadata).
 *
 * Run:  npm run ingest   (requires MONGODB_URI + AWS credentials in .env)
 */
import './_env.js'; // MUST be first — loads .env before any env-reading module.
import { embedMany } from 'ai';
import { MDocument } from '@mastra/rag';
import { MongoDBVector } from '@mastra/mongodb';
import { EMBED_DIMENSION, embeddingModel } from '../src/mastra/bedrock.js';
import { MONGODB_DATABASE, MONGODB_URI, VECTOR_INDEX } from '../src/mastra/mongo.js';

const LLMS_TXT = 'https://mastra.ai/llms.txt';
const DOCS_LIMIT = Number(process.env.DOCS_LIMIT ?? 60);
const EMBED_BATCH = 50;

type DocLink = { url: string; title: string };

/** Pull `[title](url)` links to Mastra docs `.md` pages out of the llms.txt index. */
function parseDocLinks(markdown: string): DocLink[] {
  const seen = new Set<string>();
  const links: DocLink[] = [];
  const re = /\[([^\]]+)\]\((https:\/\/mastra\.ai\/docs\/[^)]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const [, title, url] = m;
    if (!seen.has(url)) {
      seen.add(url);
      links.push({ url, title: title.trim() });
    }
  }
  return links;
}

function slug(url: string): string {
  return url.replace('https://mastra.ai/', '').replace(/[^a-zA-Z0-9]+/g, '_');
}

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');

  console.log(`Fetching docs index: ${LLMS_TXT}`);
  const index = await fetch(LLMS_TXT).then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));
  const allLinks = parseDocLinks(index);
  const links = allLinks.slice(0, DOCS_LIMIT);
  console.log(
    `Found ${allLinks.length} doc pages; ingesting ${links.length} ` +
      `(DOCS_LIMIT=${DOCS_LIMIT}${allLinks.length > links.length ? `, skipping ${allLinks.length - links.length}` : ''}).`,
  );

  const vectorStore = new MongoDBVector({ id: 'ingest', uri: MONGODB_URI, dbName: MONGODB_DATABASE });

  console.log(`Ensuring vector index "${VECTOR_INDEX}" (dimension ${EMBED_DIMENSION}, cosine)…`);
  try {
    await vectorStore.createIndex({ indexName: VECTOR_INDEX, dimension: EMBED_DIMENSION, metric: 'cosine' });
  } catch (err) {
    console.log(`  (index may already exist) ${(err as Error).message}`);
  }

  let totalChunks = 0;
  for (const [i, link] of links.entries()) {
    try {
      const md = await fetch(link.url).then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));
      const doc = MDocument.fromMarkdown(md);
      const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 1024, overlap: 100 });
      if (chunks.length === 0) continue;

      // Embed in batches to stay within provider limits.
      const texts = chunks.map(c => c.text);
      const vectors: number[][] = [];
      for (let b = 0; b < texts.length; b += EMBED_BATCH) {
        const { embeddings } = await embedMany({ model: embeddingModel, values: texts.slice(b, b + EMBED_BATCH) });
        vectors.push(...embeddings);
      }

      const pageUrl = link.url.replace(/\.md$/, ''); // rendered docs page (drop .md)
      await vectorStore.upsert({
        indexName: VECTOR_INDEX,
        vectors,
        metadata: chunks.map(c => ({ text: c.text, mdUrl: link.url, pageUrl, title: link.title })),
        ids: chunks.map((_, idx) => `${slug(link.url)}-${idx}`),
      });

      totalChunks += chunks.length;
      console.log(`  [${i + 1}/${links.length}] ${link.title} — ${chunks.length} chunks`);
    } catch (err) {
      console.warn(`  [${i + 1}/${links.length}] SKIPPED ${link.url}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. Upserted ${totalChunks} chunks from ${links.length} pages into "${VECTOR_INDEX}".`);
  await (vectorStore as unknown as { disconnect?: () => Promise<void> }).disconnect?.();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
