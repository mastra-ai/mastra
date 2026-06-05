#!/usr/bin/env node
// MastraBowl Recap — publish a markdown file as a new page in the Notion DB.
//
// Usage:
//   node scripts/publish-notion.mjs <markdown-file> [--title "Week of June 6, 2026"] [--dry-run]
//
// Reads NOTION_TOKEN and NOTION_DATABASE_ID from recap.env (or the environment).
// Detects the database's title property automatically and converts a subset of
// markdown (headings, bullets, paragraphs) into Notion blocks.
//
// No external deps — uses Node's built-in fetch (Node 18+).

import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Page/block/database creation uses the stable version whose database model
// exposes `properties` directly. The newer 2026-03-11 version moved properties
// under data sources, so we keep page creation on the stable version and only
// use the newer version for the Direct File Upload endpoints.
const NOTION_VERSION = '2022-06-28';
const UPLOAD_VERSION = '2026-03-11';
const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    const text = readFileSync(join(skillRoot, 'recap.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) {
        const val = m[2].replace(/^["']|["']$/g, '');
        if (val) env[m[1]] = val;
      }
    }
  } catch {
    /* recap.env optional if env vars already set */
  }
  return env;
}

function parseArgs(argv) {
  const args = { file: null, title: null, dryRun: false, new: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--new') args.new = true;
    else if (a === '--title') args.title = argv[++i];
    else if (!args.file) args.file = a;
  }
  return args;
}

// --- minimal markdown -> Notion blocks --------------------------------------
function richText(text) {
  // Tokenize into markdown links [label](url), **bold**, and plain text.
  // Notion rich_text supports per-span link + annotations.
  const parts = [];
  // Matches either a markdown link or a bold span.
  const token = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  const pushPlain = (s) => {
    if (!s) return;
    // Linkify any bare URLs within plain text.
    const urlRe = /(https?:\/\/[^\s]+)/g;
    let lp = 0;
    let um;
    while ((um = urlRe.exec(s)) !== null) {
      if (um.index > lp) parts.push({ type: 'text', text: { content: s.slice(lp, um.index) } });
      parts.push({ type: 'text', text: { content: um[1], link: { url: um[1] } } });
      lp = urlRe.lastIndex;
    }
    if (lp < s.length) parts.push({ type: 'text', text: { content: s.slice(lp) } });
  };
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    if (m[1] && m[2]) {
      // markdown link
      parts.push({ type: 'text', text: { content: m[1], link: { url: m[2] } } });
    } else if (m[3]) {
      // bold
      parts.push({ type: 'text', text: { content: m[3] }, annotations: { bold: true } });
    }
    last = token.lastIndex;
  }
  if (last < text.length) pushPlain(text.slice(last));
  return parts.length ? parts : [{ type: 'text', text: { content: text } }];
}

function mdToBlocks(md) {
  const blocks = [];
  const lines = md.split('\n');
  let lastTopBullet = null; // track parent bullet for nested sub-bullets
  let paraBuf = []; // accumulate wrapped lines into a single paragraph

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join(' ').replace(/\s+/g, ' ').trim();
    paraBuf = [];
    if (!text) return;
    blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } });
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Blank line ends the current paragraph.
    if (line.trim() === '') {
      flushPara();
      continue;
    }

    let m;
    // Embed: a line like "@embed https://suno.com/s/...". Renders as a Notion
    // embed block (the Suno player, YouTube, etc.).
    if ((m = line.match(/^@embed\s+(\S+)$/))) {
      flushPara();
      blocks.push({ object: 'block', type: 'embed', embed: { url: m[1] } });
      lastTopBullet = null;
    }
    // Image placeholder: a line like "!image.png". The Notion API can't upload
    // local files, so emit a callout reminding the author to drag the chart in.
    else if ((m = line.match(/^!\s*(\S+)$/))) {
      flushPara();
      // Defer: resolveImages() turns this marker into an uploaded image block
      // (or a callout fallback if the local file can't be found).
      blocks.push({ __imageFile: m[1] });
      lastTopBullet = null;
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      const level = m[1].length;
      // Notion only has h1-h3; clamp deeper headings (h4+) to h3.
      const key = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
      blocks.push({ object: 'block', type: key, [key]: { rich_text: richText(m[2]) } });
      lastTopBullet = null;
    } else if ((m = line.match(/^(\s*)[-*]\s+(.*)$/))) {
      flushPara();
      const indent = m[1].length;
      const item = {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText(m[2]) },
      };
      if (indent >= 2 && lastTopBullet) {
        lastTopBullet.bulleted_list_item.children =
          lastTopBullet.bulleted_list_item.children || [];
        lastTopBullet.bulleted_list_item.children.push(item);
      } else {
        blocks.push(item);
        lastTopBullet = item;
      }
    } else {
      // Plain text line: part of a (possibly wrapped) paragraph. Accumulate.
      paraBuf.push(line.trim());
      lastTopBullet = null;
    }
  }
  flushPara();
  // Notion caps children at 100 per request; caller should chunk if needed.
  return blocks;
}

async function notion(env, path, method = 'GET', body, version = NOTION_VERSION) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': version,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Notion ${method} ${path} -> ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };

// Upload a local file to Notion via the Direct File Upload API (3 steps) and
// return the file_upload id to attach to an image block.
async function uploadFile(env, filePath) {
  const name = basename(filePath);
  const ext = name.split('.').pop().toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // 1) create the upload (uses the newer API version for file_uploads)
  const createRes = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': UPLOAD_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename: name, content_type: contentType }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`File create failed ${createRes.status}: ${created.message || JSON.stringify(created)}`);
  }

  // 2) send the bytes (multipart/form-data; let fetch set the boundary)
  const bytes = readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), name);
  const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${created.id}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': UPLOAD_VERSION,
    },
    body: form,
  });
  const sendJson = await sendRes.json();
  if (!sendRes.ok) {
    throw new Error(`File send failed ${sendRes.status}: ${sendJson.message || JSON.stringify(sendJson)}`);
  }
  return created.id;
}

// Resolve __imageFile markers into real image blocks by uploading the local
// file. Looks for the file relative to the markdown file's dir, then the skill
// root. Falls back to a callout if the file isn't found or dry-run is set.
async function resolveImages(env, blocks, baseDir, dryRun) {
  const calloutFor = (file, note) => ({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '🖼️' },
      rich_text: [{ type: 'text', text: { content: `Attach image: ${file}${note ? ` (${note})` : ''}` } }],
    },
  });

  const out = [];
  for (const b of blocks) {
    if (!b.__imageFile) {
      out.push(b);
      continue;
    }
    const file = b.__imageFile;
    const candidates = [resolve(baseDir, file), resolve(skillRoot, file)];
    const found = candidates.find((p) => existsSync(p));
    if (!found) {
      out.push(calloutFor(file, 'file not found'));
      continue;
    }
    if (dryRun) {
      out.push(calloutFor(file, `would upload from ${found}`));
      continue;
    }
    const id = await uploadFile(env, found);
    out.push({
      object: 'block',
      type: 'image',
      image: { type: 'file_upload', file_upload: { id } },
    });
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.file) {
    console.error('Usage: node scripts/publish-notion.mjs <markdown-file> [--title "..."] [--dry-run]');
    process.exit(1);
  }
  const mdPath = resolve(process.cwd(), args.file);
  const md = readFileSync(mdPath, 'utf8');
  const rawBlocks = mdToBlocks(md);

  // Default title: "Week of <today>"
  const title =
    args.title ||
    `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  if (args.dryRun) {
    const blocks = await resolveImages(env, rawBlocks, dirname(mdPath), true);
    const imgMarkers = blocks.filter((b) => b.type === 'callout').length;
    console.log(`[dry-run] Title: ${title}`);
    console.log(`[dry-run] ${blocks.length} blocks; ${imgMarkers} image marker(s) resolved to placeholders.`);
    console.log(JSON.stringify(blocks.slice(0, 5), null, 2));
    return;
  }

  if (!env.NOTION_TOKEN) throw new Error('NOTION_TOKEN missing (set it in recap.env).');
  if (!env.NOTION_DATABASE_ID) throw new Error('NOTION_DATABASE_ID missing (set it in recap.env).');

  // Upload local images and turn markers into real image blocks.
  const blocks = await resolveImages(env, rawBlocks, dirname(mdPath), false);

  // Newer API versions expose properties via data sources, not the database
  // directly, and the database VIEW reads from a data source. Pages parented to
  // a bare database_id don't show up in the view, so we parent to the data
  // source instead. Resolve the data source id and its title property.
  const db = await notion(env, `databases/${env.NOTION_DATABASE_ID}`, 'GET', undefined, UPLOAD_VERSION);
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) throw new Error('No data source found on the database.');
  const ds = await notion(env, `data_sources/${dataSourceId}`, 'GET', undefined, UPLOAD_VERSION);
  const titleProp = Object.entries(ds.properties).find(([, p]) => p.type === 'title')?.[0];
  if (!titleProp) throw new Error('Could not find a title property on the data source.');

  // Notion limits children to 100 per create call; send first 100, append rest.
  const first = blocks.slice(0, 100);
  const rest = blocks.slice(100);

  // Upsert by title: reuse an existing (non-trashed) page with the same title so
  // re-publishing doesn't litter the database with duplicates. Pass --new to
  // always create a fresh page.
  let existing = null;
  if (!args.new) {
    const q = await notion(
      env,
      `data_sources/${dataSourceId}/query`,
      'POST',
      { filter: { property: titleProp, title: { equals: title } }, page_size: 1 },
      UPLOAD_VERSION,
    );
    existing = q.results?.find((p) => !p.in_trash && !p.archived) || null;
  }

  let page;
  if (existing) {
    // Replace the page's content: delete current children, then append new ones.
    const kids = await notion(env, `blocks/${existing.id}/children?page_size=100`, 'GET', undefined, UPLOAD_VERSION);
    for (const child of kids.results || []) {
      await notion(env, `blocks/${child.id}`, 'DELETE', undefined, UPLOAD_VERSION);
    }
    for (let i = 0; i < blocks.length; i += 100) {
      await notion(env, `blocks/${existing.id}/children`, 'PATCH', { children: blocks.slice(i, i + 100) }, UPLOAD_VERSION);
    }
    page = existing;
    console.log(`Updated Notion page: ${page.url}`);
  } else {
    page = await notion(
      env,
      'pages',
      'POST',
      {
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties: { [titleProp]: { title: [{ text: { content: title } }] } },
        children: first,
      },
      UPLOAD_VERSION,
    );
    for (let i = 0; i < rest.length; i += 100) {
      await notion(env, `blocks/${page.id}/children`, 'PATCH', { children: rest.slice(i, i + 100) }, UPLOAD_VERSION);
    }
    console.log(`Created Notion page: ${page.url}`);
  }
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
