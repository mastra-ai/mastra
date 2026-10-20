import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type WorkspacePackage = {
  name: string;
  dir: string;
  private: boolean;
  /** Runtime edges: dependencies, peerDependencies and optionalDependencies on other in-repo packages. */
  dependsOn: string[];
};

export type PackageBlastRadius = {
  name: string;
  dir: string;
  area: string;
  directDependents: number;
  transitiveDependents: number;
  publishedTransitiveDependents: number;
};

export type FileContext = {
  filename: string;
  package: PackageBlastRadius | null;
  owners: string[];
};

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.turbo', '.next', 'build', 'coverage']);

export function loadWorkspacePackages(repoRoot: string): WorkspacePackage[] {
  const manifests: Array<{ dir: string; json: Record<string, unknown> }> = [];
  const walk = (relDir: string) => {
    const absDir = join(repoRoot, relDir);
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(relDir ? `${relDir}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name === 'package.json' && relDir) {
        try {
          manifests.push({ dir: relDir, json: JSON.parse(readFileSync(join(absDir, entry.name), 'utf8')) });
        } catch {
          // A malformed manifest only loses blast-radius detail for that package.
        }
      }
    }
  };
  walk('');

  const names = new Set(manifests.map(m => m.json.name).filter((n): n is string => typeof n === 'string'));
  return manifests
    .filter(m => typeof m.json.name === 'string')
    .map(({ dir, json }) => {
      const deps = new Set<string>();
      for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        const value = json[field];
        if (value && typeof value === 'object') {
          for (const dep of Object.keys(value)) if (names.has(dep)) deps.add(dep);
        }
      }
      return { name: json.name as string, dir, private: json.private === true, dependsOn: [...deps] };
    });
}

export class WorkspaceIndex {
  private readonly byDir: WorkspacePackage[];
  private readonly dependents = new Map<string, Set<string>>();
  private readonly packages = new Map<string, WorkspacePackage>();

  constructor(packages: WorkspacePackage[], private readonly codeowners: CodeownersRule[] = []) {
    this.byDir = [...packages].sort((a, b) => b.dir.length - a.dir.length);
    for (const pkg of packages) {
      this.packages.set(pkg.name, pkg);
      for (const dep of pkg.dependsOn) {
        if (!this.dependents.has(dep)) this.dependents.set(dep, new Set());
        this.dependents.get(dep)!.add(pkg.name);
      }
    }
  }

  static load(repoRoot: string): WorkspaceIndex {
    const codeownersPath = join(repoRoot, '.github', 'CODEOWNERS');
    const codeowners = existsSync(codeownersPath) ? parseCodeowners(readFileSync(codeownersPath, 'utf8')) : [];
    return new WorkspaceIndex(loadWorkspacePackages(repoRoot), codeowners);
  }

  packageFor(filename: string): WorkspacePackage | null {
    return this.byDir.find(pkg => filename.startsWith(`${pkg.dir}/`)) ?? null;
  }

  blastRadius(pkg: WorkspacePackage): PackageBlastRadius {
    const direct = this.dependents.get(pkg.name) ?? new Set<string>();
    const seen = new Set<string>();
    const queue = [...direct];
    while (queue.length > 0) {
      const next = queue.pop()!;
      if (seen.has(next) || next === pkg.name) continue;
      seen.add(next);
      queue.push(...(this.dependents.get(next) ?? []));
    }
    const published = [...seen].filter(name => this.packages.get(name)?.private === false).length;
    return {
      name: pkg.name,
      dir: pkg.dir,
      area: pkg.dir.split('/')[0]!,
      directDependents: direct.size,
      transitiveDependents: seen.size,
      publishedTransitiveDependents: published,
    };
  }

  fileContext(filename: string): FileContext {
    const pkg = this.packageFor(filename);
    return {
      filename,
      package: pkg ? this.blastRadius(pkg) : null,
      owners: ownersFor(this.codeowners, filename),
    };
  }
}

export type CodeownersRule = { pattern: RegExp; owners: string[] };

export function parseCodeowners(text: string): CodeownersRule[] {
  const rules: CodeownersRule[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    rules.push({ pattern: codeownersPatternToRegExp(pattern!), owners: owners.filter(o => o.startsWith('@')) });
  }
  return rules;
}

/** GitHub CODEOWNERS semantics: the last matching rule wins. */
export function ownersFor(rules: CodeownersRule[], filename: string): string[] {
  for (let i = rules.length - 1; i >= 0; i--) {
    if (rules[i]!.pattern.test(filename)) return rules[i]!.owners;
  }
  return [];
}

function codeownersPatternToRegExp(pattern: string): RegExp {
  const anchored = pattern.startsWith('/') || pattern.slice(0, -1).includes('/');
  let body = pattern.replace(/^\//, '');
  const directory = body.endsWith('/');
  body = body.replace(/\/$/, '');

  let source = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i]!;
    if (char === '*' && body[i + 1] === '*') {
      source += '.*';
      i++;
      if (body[i + 1] === '/') i++;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  const prefix = anchored ? '^' : '(^|.*/)';
  const suffix = directory ? '/.*$' : '(/.*)?$';
  return new RegExp(`${prefix}${source}${suffix}`);
}
