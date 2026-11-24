import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const documentation = [
  'README.md',
  'CONTRIBUTING.md',
  '.env.example',
  'docs/policies-and-actions.md',
  'docs/external-adapters.md',
  'docs/local-demo.md',
  'docs/env-variables.md',
];
const errors = [];
const packageScripts = {
  root: Object.keys(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts),
  web: Object.keys(JSON.parse(readFileSync(resolve(root, 'support-demo-ui/package.json'), 'utf8')).scripts),
  demo: Object.keys(JSON.parse(readFileSync(resolve(root, 'client-demo-ui/package.json'), 'utf8')).scripts),
};
const workspaceScripts = {
  'support-demo-ui': packageScripts.web,
  'client-demo-ui': packageScripts.demo,
};

for (const file of documentation) {
  const path = resolve(root, file);
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^mailto:/.test(target)) continue;
    const githubTarget = sameRepositoryGithubTarget(target);
    if (/^https?:/.test(target) && !githubTarget) continue;
    if (file === 'README.md' && !githubTarget) {
      errors.push(`${file} must use absolute links, not ${target}.`);
      continue;
    }
    const [targetPath, targetAnchor] = target.split('#', 2);
    const localPath = githubTarget?.path ?? (targetPath ? resolve(dirname(path), targetPath) : path);
    const anchor = githubTarget?.anchor ?? targetAnchor;
    if (!existsSync(localPath)) {
      errors.push(`${file} links to missing repository path ${target}.`);
      continue;
    }
    if (anchor && !hasAnchor(localPath, anchor)) errors.push(`${file} links to missing anchor ${target}.`);
  }
  if (/\b(?:bun|pnpm|yarn)\s+(?:run|install|dev|build)\b/i.test(text))
    errors.push(`${file} contains a stale package-manager command.`);
  if (/TEMPLATE_NAME|create-mastria/i.test(text))
    errors.push(`${file} contains an unresolved template placeholder or stale command.`);
  if (/\b(?:sk-[A-Za-z0-9_-]{16,}|rk_live_[A-Za-z0-9_-]{16,}|whsec_[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/.test(text))
    errors.push(`${file} contains a value that looks like a committed secret.`);
  for (const match of text.matchAll(/npm\s+run(?:\s+--workspace\s+([^\s]+))?\s+([A-Za-z0-9:_-]+)/g)) {
    const [, workspace, script] = match;
    const available = workspace ? workspaceScripts[workspace] : packageScripts.root;
    if (!available) {
      errors.push(`${file} references unknown npm workspace ${workspace}.`);
      continue;
    }
    if (!available.includes(script)) errors.push(`${file} references missing npm script ${script}.`);
  }
}

const demoExample = readFileSync(resolve(root, 'docs/local-demo.md'), 'utf8');
if (
  !/every\s+(?:identity|message|order|result|example)[\s\S]{0,120}\b(?:synthetic|mock(?:ed)? data)\b/i.test(demoExample)
)
  errors.push('docs/local-demo.md must identify every example as mock data or synthetic.');

if (errors.length) throw new Error(`Documentation validation failed:\n- ${errors.join('\n- ')}`);
console.log(`Documentation validation passed for ${documentation.length} files.`);

function hasAnchor(path, anchor) {
  if (!path.endsWith('.md')) return false;
  const requested = decodeURIComponent(anchor).toLowerCase();
  const seen = new Map();
  for (const heading of readFileSync(path, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = headingId(heading[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (`${base}${count ? `-${count}` : ''}` === requested) return true;
  }
  return false;
}

function headingId(heading) {
  return heading
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[\\`*_~]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function sameRepositoryGithubTarget(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return undefined;
  const match = /^\/mastra-ai\/mastra\/(?:blob|tree)\/main\/templates\/template-customer-refund-agent\/(.+)$/.exec(
    url.pathname,
  );
  if (!match) return undefined;
  const path = resolve(root, decodeURIComponent(match[1]));
  const pathFromRoot = relative(root, path);
  if (pathFromRoot === '..' || pathFromRoot.startsWith('../')) return undefined;
  return {
    path,
    anchor: url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined,
  };
}
