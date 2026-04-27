import fs from 'node:fs/promises';
import path from 'node:path';
import { getAppDataDir } from './project.js';

function slugify(str: string): string {
  const slug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'untitled';
}

export async function savePlanToDisk(opts: {
  title: string;
  plan: string;
  resourceId: string;
  plansDir?: string;
}): Promise<void> {
  const { title, plan, resourceId } = opts;
  const plansDir = opts.plansDir ?? process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
  const dir = path.join(plansDir, resourceId);

  await fs.mkdir(dir, { recursive: true });

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-');
  const slug = slugify(title);
  const filename = `${timestamp}-${slug}.md`;

  const content = `# ${title}\n\nApproved: ${now.toISOString()}\n\n${plan}\n`;

  await fs.writeFile(path.join(dir, filename), content, 'utf-8');
}
