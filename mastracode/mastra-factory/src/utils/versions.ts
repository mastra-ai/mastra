import fs from 'node:fs/promises';
import path from 'node:path';
import { x } from 'tinyexec';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
const NPM_VIEW_TIMEOUT_MS = 15_000;

export function isMastraPackage(name: string): boolean {
  return name === 'mastra' || name.startsWith('@mastra/');
}

export interface PinResult {
  /** Package name → exact version written to package.json. */
  pinned: Record<string, string>;
  /** Mastra packages that have no published version under the tag; left as the template had them. */
  unresolved: string[];
}

/**
 * Rewrite every `mastra` / `@mastra/*` dependency in the scaffolded
 * package.json to the exact version its `tag` dist-tag points at, so the
 * install uses that release channel. Templates declare these as `latest`, so
 * without this an install always takes the stable channel.
 */
export async function pinMastraPackages(projectPath: string, tag: string): Promise<PinResult> {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as Record<string, unknown>;

  const names = new Set<string>();
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    for (const name of Object.keys(deps ?? {})) {
      if (isMastraPackage(name)) names.add(name);
    }
  }

  const resolved = await Promise.all(
    [...names].sort().map(async name => [name, await resolveDistTag(name, tag, projectPath)] as const),
  );

  const pinned: Record<string, string> = {};
  const unresolved: string[] = [];
  for (const [name, version] of resolved) {
    if (version) pinned[name] = version;
    else unresolved.push(name);
  }

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (Object.hasOwn(pinned, name)) deps[name] = pinned[name]!;
    }
  }

  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return { pinned, unresolved };
}

async function resolveDistTag(name: string, tag: string, cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await x('npm', ['view', name, 'dist-tags', '--json'], {
      throwOnError: true,
      timeout: NPM_VIEW_TIMEOUT_MS,
      // Read the project's npm config (e.g. a custom registry) like the install does.
      nodeOptions: { cwd },
    });
    const tags = JSON.parse(stdout) as Record<string, unknown>;
    const version = tags[tag];
    return typeof version === 'string' && version ? version : undefined;
  } catch {
    return undefined;
  }
}
