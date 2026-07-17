#!/usr/bin/env node
/**
 * Produces the Mastra Software Factory template tree from `mastracode/web`.
 *
 * The template is the web project minus monorepo coupling:
 *   - `link:` deps           -> caret ranges on published versions (verified on npm)
 *   - monorepo tsconfig      -> standalone tsconfig
 *   - contributor README     -> user-facing README
 *   - e2e/tests/test deps    -> stripped
 *   - monorepo-only scripts  -> user-facing scripts (dev/build/start/deploy)
 *   - .env.schema            -> also emitted as .env.example (decorators stripped)
 *
 * Versions: Mastra deps become caret ranges (`^1.51.0` style), matching the
 * monorepo's other templates (templates/* float via `latest`/caret). By
 * default the range is anchored on the LOCAL monorepo version of each
 * package (verified to exist on npm); `--tag latest` anchors on the `latest`
 * dist-tags instead — that's what the automated sync uses. Because anchors
 * may be prereleases in the default mode, the template ships an `.npmrc`
 * with `legacy-peer-deps=true` — npm's strict resolver rejects prereleases
 * like `1.51.1-alpha.1` against peer ranges like `>=1.50.0-0`.
 *
 * Usage:
 *   node scripts/sync-template.mjs [--out <dir>] [--tag latest]
 *
 * Output defaults to `template-out/` next to this package (gitignored).
 * Publish flow: automated — the sync-softwarefactory-template workflow runs
 * this with `--tag latest` on pushes to main touching `mastracode/web` and
 * force-syncs github.com/mastra-ai/softwarefactory-template, mirroring the
 * templates/* sync process (one-way overwrite; the monorepo is the source of
 * truth).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const monorepoRoot = path.resolve(pkgRoot, '../..');

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}
const outDir = path.resolve(argValue('--out') ?? path.join(pkgRoot, 'template-out'));
const pinTag = argValue('--tag'); // undefined = local monorepo versions

/** True when `candidate` is `parent` or nested inside it. */
function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// The output tree gets cleared before copying — refuse destinations that
// would wipe the source web project or (unless it's the default
// template-out) this package / the monorepo.
if (containsPath(outDir, webRoot) || containsPath(webRoot, outDir) || containsPath(outDir, pkgRoot)) {
  console.error(`sync-template: unsafe output directory ${outDir} (overlaps the source tree)`);
  process.exit(1);
}

/**
 * Resolve a `link:` spec from the web manifest to the linked package's
 * monorepo directory (relative to monorepoRoot). Link paths are relative to
 * the web project root (e.g. `link:../../stores/pg` -> `stores/pg`).
 *
 * Linked packages are discovered from the manifest rather than a hardcoded
 * list so a new `link:` dep added to mastracode/web can never slip into the
 * template untransformed (npm cannot install `link:` specs).
 */
function linkSpecToRelPath(spec) {
  const target = path.resolve(webRoot, spec.slice('link:'.length));
  const rel = path.relative(monorepoRoot, target);
  if (rel.startsWith('..')) {
    throw new Error(`sync-template: link spec ${spec} resolves outside the monorepo (${target})`);
  }
  return rel;
}

/** devDependencies that only support the monorepo test suites. */
const TEST_ONLY_DEV_DEPS = [
  '@ai-sdk/openai',
  '@copilotkit/aimock',
  '@testing-library/dom',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  'jsdom',
  'msw',
  'tsx',
  'vitest',
];

/** Top-level entries never copied into the template. */
const EXCLUDE_TOP_LEVEL = new Set([
  'node_modules',
  '.mastra',
  'e2e',
  'pnpm-lock.yaml',
  'vitest.config.ts',
  // Replaced with template-specific versions:
  'README.md',
  '.gitignore',
  'tsconfig.json',
]);

/** Path predicates (relative, posix separators) for excluded files anywhere. */
function isExcluded(rel) {
  const basename = path.posix.basename(rel);
  if (rel.startsWith('src/mastra/public/')) return true; // vite build output
  if (rel === 'scripts/monorepo-deps.mjs') return true;
  if (rel === 'src/web/test-utils.ts') return true;
  if (/(^|\/)__tests__(\/|$)/.test(rel)) return true;
  if (/\.test\.(ts|tsx|mts|mjs)$/.test(rel)) return true;
  // Never ship someone's local env (.env, .env.local, ...) — only the schema.
  if (basename === '.env' || (basename.startsWith('.env.') && basename !== '.env.schema')) return true;
  return false;
}

function copyTree(srcDir, destDir, relBase = '') {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (!relBase && EXCLUDE_TOP_LEVEL.has(entry.name)) continue;
    if (isExcluded(rel)) continue;
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, rel);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function monorepoVersion(name, relPath) {
  const pkgJsonPath = path.join(monorepoRoot, relPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.name !== name) {
    throw new Error(`sync-template: ${pkgJsonPath} is named ${pkg.name}, expected ${name}`);
  }
  return pkg.version;
}

/**
 * Resolve the version to pin: the local monorepo version (default, verified
 * published) or the requested dist-tag.
 */
function resolvePinnedVersion(name, relPath) {
  if (pinTag) {
    try {
      return execFileSync('npm', ['view', name, `dist-tags.${pinTag}`], { stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      throw new Error(`sync-template: could not resolve ${name}@${pinTag} on npm.`);
    }
  }
  const version = monorepoVersion(name, relPath);
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      `sync-template: ${name}@${version} (local monorepo version) is not published on npm — ` +
        `publish it (or wait for the release train), or sync with --tag latest.`,
    );
  }
  return version;
}

function transformPackageJson() {
  const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));

  manifest.name = 'mastra-software-factory';
  manifest.version = '0.1.0';
  manifest.description =
    'Mastra Software Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.';
  manifest.private = true;
  manifest.license = 'Apache-2.0';

  // Direct mapping of the web project's own scripts (web:dev / web:build /
  // web:start), minus monorepo-only bits (prebuild, monorepo-deps.mjs).
  manifest.scripts = {
    dev: 'concurrently --kill-others-on-fail --names server,ui "MASTRA_SKIP_PEERDEP_CHECK=1 varlock run -- mastra dev --dir src/mastra" "vite --config src/web/vite.config.ts"',
    'db:up': 'docker compose up -d --wait',
    'db:down': 'docker compose down',
    build: 'npm run build:ui && npm run build:server',
    'build:ui': 'vite --config src/web/vite.config.ts build',
    'build:server': 'mastra build --dir src/mastra',
    start: 'varlock run -- mastra start',
    deploy: 'npm run build && node scripts/validate-output.mjs && mastra deploy --skip-build',
    check: 'tsc --noEmit && tsc --noEmit -p src/web/ui/tsconfig.json',
  };

  const pins = [];
  console.log(
    pinTag
      ? `sync-template: pinning npm ${pinTag} dist-tags...`
      : 'sync-template: pinning local monorepo versions (verified on npm)...',
  );
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = manifest[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (!spec.startsWith('link:')) continue;
      const version = resolvePinnedVersion(name, linkSpecToRelPath(spec));
      // Caret ranges, matching the monorepo's other templates (templates/*):
      // the scaffold floats to compatible releases instead of freezing the
      // exact set that existed at sync time.
      deps[name] = `^${version}`;
      pins.push([name, version]);
      console.log(`  ✓ ${name}@^${version}`);
    }
  }

  for (const dep of TEST_ONLY_DEV_DEPS) {
    delete manifest.devDependencies?.[dep];
  }

  // npm cannot install monorepo-only protocols; nothing may slip through.
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (/^(link:|workspace:|file:|catalog:)/.test(spec)) {
        throw new Error(`sync-template: unresolved monorepo spec in template: ${name}@${spec}`);
      }
    }
  }

  // The template installs with `legacy-peer-deps=true` (see writeNpmrc), which
  // skips automatic peer installation. Most peers are already direct deps;
  // these transitive runtime peers are not, so declare them explicitly.
  // (In the monorepo dev setup pnpm's auto-install-peers provides them.)
  manifest.dependencies['react-is'] = '^19.0.0'; // peer of recharts (via @mastra/playground-ui)

  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return pins;
}

function writeTsconfig() {
  // Standalone equivalent of the monorepo's tsconfig.node.json + the web
  // package's local include/exclude (test files are already stripped).
  const tsconfig = {
    compilerOptions: {
      esModuleInterop: true,
      skipLibCheck: true,
      target: 'es2022',
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: 'force',
      isolatedModules: true,
      verbatimModuleSyntax: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      declaration: true,
      declarationMap: true,
      module: 'Preserve',
      noEmit: true,
      lib: ['ES2023'],
      types: ['node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'src/web/ui', 'src/web/vite.config.ts', 'src/shared/**/*.tsx', 'src/shared/hooks'],
  };
  fs.writeFileSync(path.join(outDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

function stripTestingTypesFromUiTsconfig() {
  const uiTsconfigPath = path.join(outDir, 'src/web/ui/tsconfig.json');
  const raw = fs.readFileSync(uiTsconfigPath, 'utf8');
  // The template drops @testing-library/* deps, so the ambient types entry
  // would fail `tsc -p src/web/ui/tsconfig.json`.
  const next = raw.replace(`, "@testing-library/jest-dom"`, '');
  if (next === raw) {
    throw new Error('sync-template: expected "@testing-library/jest-dom" in src/web/ui/tsconfig.json types');
  }
  fs.writeFileSync(uiTsconfigPath, next);
}

function writeEnvExample() {
  // Derive .env.example from .env.schema: drop varlock decorator comments
  // (`# @...`) and the schema header block, keep prose comments + assignments.
  const schema = fs.readFileSync(path.join(webRoot, '.env.schema'), 'utf8');
  const lines = schema.split('\n');
  const out = [];
  let inHeader = true;
  for (const line of lines) {
    if (inHeader) {
      // Header ends at the `# ---` divider that closes the varlock file header.
      if (line.trim() === '# ---') inHeader = false;
      continue;
    }
    if (/^\s*#\s*@/.test(line)) continue; // varlock decorator line
    // Empty assignments become commented placeholders: an active `KEY=` loads
    // as the empty string (not "unset"), which poisons the server's
    // `process.env.X ?? default` fallbacks.
    if (/^[A-Z][A-Z0-9_]*=\s*$/.test(line)) {
      out.push(`# ${line.trim()}`);
      continue;
    }
    out.push(line);
  }
  const body = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
  const header = [
    '# Mastra Software Factory environment.',
    '# Copied to .env by `npm create softwarefactory`; every value is optional —',
    '# features light up as their variables are set (see README.md).',
    '# Validation source of truth: .env.schema (varlock).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, '.env.example'), `${header}${body}`);
}

function writeNpmrc() {
  // Pins may be prerelease versions (mid-train alphas); npm's strict resolver
  // rejects prereleases against peer ranges like `>=1.50.0-0`, so relax peer
  // resolution. pnpm/yarn ignore this setting and handle peers leniently.
  fs.writeFileSync(path.join(outDir, '.npmrc'), 'legacy-peer-deps=true\n');
}

function writeGitignore() {
  fs.writeFileSync(
    path.join(outDir, '.gitignore'),
    `node_modules/
.env
.env.*
!.env.example
!.env.schema
.mastra/
src/mastra/public/ui/
*.log
.DS_Store
`,
  );
}

function writeReadme(pins) {
  const versions = Object.fromEntries(pins);
  const readme = `# Mastra Software Factory

An open source, agent-powered software delivery environment built on [Mastra](https://mastra.ai). Connect GitHub and Linear, pull issues into an intake board, hand them to coding agents, and ship pull requests — from a web app you own and can deploy anywhere.

Created with [\`npm create softwarefactory\`](https://www.npmjs.com/package/create-softwarefactory).

## Quick start

\`\`\`bash
npm install

# optional: local Postgres (+pgvector) & Redis via Docker
npm run db:up

npm run dev
\`\`\`

- **Factory UI** → http://localhost:5173
- **Mastra Studio** → http://localhost:4111
- **API** → http://localhost:4111/api

With zero configuration the app runs in local, auth-less mode (agents + local storage, no integrations). Open the Factory UI to finish setup — model provider keys are added there (Settings › Models). Deployment-level features enable themselves as you add environment variables — see below.

### Ports

The UI port is **strict**: if 5173 is taken, \`npm run dev\` fails instead of moving to a free port, because OAuth callback URLs (WorkOS/GitHub/Linear) are registered against the configured origin and would silently break. To run on a different port, change both together — run with \`MASTRACODE_UI_PORT=<port>\` and set \`MASTRACODE_PUBLIC_URL=http://localhost:<port>\` in \`.env\` (then update the callback URLs on your OAuth apps). The API server port is overridable with \`PORT\`.

## Configuration

Day-to-day configuration (model providers, integrations) happens in the web UI. Deployment-level settings live in \`.env\` (validated against \`.env.schema\` by [varlock](https://varlock.dev)). Every value is optional; each feature activates when its variables are set. Restart \`npm run dev\` after changing \`.env\`.

| Feature | Requires |
| --- | --- |
| Agents / model providers | add keys in the UI (Settings › Models), or \`ANTHROPIC_API_KEY\` / \`OPENAI_API_KEY\` |
| Sign-in (WorkOS) | \`WORKOS_API_KEY\`, \`WORKOS_CLIENT_ID\` |
| GitHub projects & intake | WorkOS + \`GITHUB_APP_ID\`, \`GITHUB_APP_PRIVATE_KEY\`, \`GITHUB_APP_CLIENT_ID\`, \`GITHUB_APP_CLIENT_SECRET\`, \`GITHUB_APP_SLUG\` + \`APP_DATABASE_URL\` |
| Linear intake | WorkOS + \`LINEAR_CLIENT_ID\`, \`LINEAR_CLIENT_SECRET\` + \`APP_DATABASE_URL\` + a state secret (\`GITHUB_APP_WEBHOOK_SECRET\` or \`WORKOS_COOKIE_PASSWORD\`) |
| Distributed event bus | \`REDIS_URL\` (only needed for multi-process deployments) |
| Cloud sandboxes | \`RAILWAY_API_TOKEN\` (defaults to a local git sandbox otherwise) |

### Database

Integrations and shared agent state need Postgres **with the pgvector extension**. Two easy options:

- **Local Docker** (recommended to start): \`npm run db:up\` starts Postgres on \`localhost:54329\` matching \`APP_DATABASE_URL=postgres://user:pass@localhost:54329/mastracode_web\` (plus Redis on \`localhost:63799\`).
- **Hosted Postgres**: any provider works if pgvector is available (Neon, Supabase, Railway, RDS, ...) — enable the extension and set \`APP_DATABASE_URL\`.

Without \`APP_DATABASE_URL\`, agent state falls back to a local libSQL file and integrations stay off.

### Sign-in (WorkOS)

Integrations are per-organization, so they require sign-in, powered by [WorkOS](https://workos.com) (free tier is fine):

1. Create a WorkOS project → copy the **API key** and **Client ID** into \`.env\`.
2. In WorkOS → Redirects, add \`http://localhost:5173/auth/callback\`.
3. Set \`WORKOS_COOKIE_PASSWORD\` to a random 32+ character string.

### GitHub

The Factory connects to GitHub through a GitHub App you own. Create an app at https://github.com/settings/apps/new (or under your org) and set the \`GITHUB_APP_*\` variables in \`.env\`.

The app needs **Contents, Issues, Pull requests** (Read & write) and **Metadata** (Read-only) permissions. Set its callback URL to \`<your app origin>/auth/github/callback\`.

Webhooks (optional — powers auto-triage and PR notifications, requires a public host; GitHub rejects localhost webhook URLs): in the App settings, set the webhook URL to \`https://<public-host>/web/github/webhook\` with the \`GITHUB_APP_WEBHOOK_SECRET\` from \`.env\` as the secret, activate it, and subscribe to the **issues, issue_comment, pull_request, pull_request_review, pull_request_review_comment** events. Local development works without webhooks; issues are fetched on demand.

### Linear (optional)

Create a Linear OAuth app (Linear → Settings → API → OAuth applications → New) with callback URL \`<your app origin>/auth/linear/callback\`, then set \`LINEAR_CLIENT_ID\` / \`LINEAR_CLIENT_SECRET\` in \`.env\`.

## Scripts

| Script | What it does |
| --- | --- |
| \`npm run dev\` | API server (:4111) + Factory UI (:5173) with live reload |
| \`npm run db:up\` / \`db:down\` | Start/stop local Postgres + Redis (Docker) |
| \`npm run build\` | Build the SPA and bundle the server to \`.mastra/output\` |
| \`npm run start\` | Run the production build |
| \`npm run deploy\` | Build, validate, and deploy to [Mastra Cloud](https://mastra.ai/docs/mastra-platform/overview) |
| \`npm run check\` | Typecheck server and UI |

## Requirements

- Node.js ≥ 22.19
- Docker (optional, for the local database)
- Postgres 15+ with pgvector (for integrations)

## Versions

The Mastra packages use caret ranges (currently anchored on \`@mastra/core@${versions['@mastra/core']}\` and \`@mastra/code-sdk@${versions['@mastra/code-sdk']}\`). Upgrade them together when updating.

## License

Apache-2.0
`;
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);
}

// ── main ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(path.join(webRoot, 'package.json'))) {
  console.error(`sync-template: web project not found at ${webRoot}`);
  process.exit(1);
}

console.log(`sync-template: ${webRoot} -> ${outDir}`);
// Clear the output tree but keep its .git — template-out doubles as the
// checkout that pushes to the template repo, and deleting .git would make
// git commands silently fall through to the enclosing monorepo repo.
if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
}
copyTree(webRoot, outDir);
const pins = transformPackageJson();
writeTsconfig();
stripTestingTypesFromUiTsconfig();
writeEnvExample();
writeNpmrc();
writeGitignore();
writeReadme(pins);

console.log(`sync-template: done. Template written to ${outDir}`);
console.log('The sync-softwarefactory-template workflow pushes this to the template repo on main.');
