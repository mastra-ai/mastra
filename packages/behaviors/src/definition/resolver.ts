import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import type { BehaviorGuard, NormalizedBehaviorDefinition } from './types.js';
import { BehaviorDefinitionError } from './types.js';

export type BehaviorPath = `$root${string}`;

export type BehaviorNode = Readonly<{
  id: BehaviorPath;
  name: string;
  version: string;
  instructions?: string;
  judgeInstructions?: string;
  skills: readonly string[];
  tools: readonly string[];
  model?: string;
  judgeModel?: string;
  guards: readonly Readonly<BehaviorGuard>[];
  judge: boolean;
  destinations?: readonly string[];
  periodic?: Readonly<{ intervalMs: number; destination: string }>;
}>;

export interface BehaviorResolver {
  readonly id: string;
  readonly root: BehaviorPath;
  resolve(id: BehaviorPath): Promise<BehaviorNode | undefined>;
  children(id: BehaviorPath): Promise<readonly BehaviorNode[]>;
  parent(id: BehaviorPath): BehaviorPath | undefined;
}

export interface MutableBehaviorResolver extends BehaviorResolver {
  set(id: BehaviorPath, node: Omit<BehaviorNode, 'id' | 'name'> & { name?: string }): void;
  remove(id: BehaviorPath): void;
}

const normalizePath = (value: string): BehaviorPath => {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/g, '') || '$root';
  if (normalized !== '$root' && !normalized.startsWith('$root/')) throw new Error(`Behavior path must start with "$root": ${value}`);
  if (normalized.split('/').some(segment => segment === '..' || segment === '.')) throw new Error(`Behavior path may not traverse: ${value}`);
  return normalized as BehaviorPath;
};

const resolveDestination = (from: BehaviorPath, destination: string): BehaviorPath => {
  if (destination === '$root' || destination.startsWith('$root/')) return normalizePath(destination);
  const base = from === '$root' ? '$root' : from;
  return normalizePath(`${base}/behaviors/${destination}`);
};

export class InMemoryBehaviorResolver implements MutableBehaviorResolver {
  readonly root = '$root' as const;
  private readonly nodes = new Map<BehaviorPath, BehaviorNode>();

  constructor(readonly id: string, root?: Omit<BehaviorNode, 'id' | 'name'> & { name?: string }) {
    this.set(this.root, root ?? { version: '1', skills: [], tools: [], guards: [], judge: false });
  }

  set(id: BehaviorPath, node: Omit<BehaviorNode, 'id' | 'name'> & { name?: string }): void {
    const canonical = normalizePath(id);
    this.nodes.set(canonical, Object.freeze({ ...node, id: canonical, name: node.name ?? canonical.split('/').at(-1)! }));
  }

  remove(id: BehaviorPath): void {
    const canonical = normalizePath(id);
    for (const key of this.nodes.keys()) if (key === canonical || key.startsWith(`${canonical}/`)) this.nodes.delete(key);
  }

  async resolve(id: BehaviorPath): Promise<BehaviorNode | undefined> {
    return this.nodes.get(normalizePath(id));
  }

  async children(id: BehaviorPath): Promise<readonly BehaviorNode[]> {
    const canonical = normalizePath(id);
    const prefix = canonical === '$root' ? '$root/' : `${canonical}/`;
    const result: BehaviorNode[] = [];
    for (const [candidate, node] of this.nodes) {
      if (!candidate.startsWith(prefix)) continue;
      const remainder = candidate.slice(prefix.length);
      if (!remainder.includes('/') || remainder.startsWith('behaviors/') && remainder.slice('behaviors/'.length).split('/').length === 1) result.push(node);
    }
    const current = this.nodes.get(canonical);
    for (const destination of current?.destinations ?? []) {
      const node = this.nodes.get(resolveDestination(canonical, destination));
      if (node && !result.some(candidate => candidate.id === node.id)) result.push(node);
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  parent(id: BehaviorPath): BehaviorPath | undefined {
    const canonical = normalizePath(id);
    if (canonical === '$root') return undefined;
    const parts = canonical.split('/');
    parts.pop();
    if (parts.at(-1) === 'behaviors') parts.pop();
    return (parts.join('/') || '$root') as BehaviorPath;
  }
}

type Frontmatter = {
  id?: string;
  version?: string;
  tools?: string[];
  skills?: string[];
  model?: string;
  judgeModel?: string;
  judge?: boolean;
  guards?: BehaviorGuard[];
  periodic?: { intervalMs: number; destination: string };
  destinations?: string[];
};

const readBehaviorMarkdown = (source: string): { frontmatter: Frontmatter; instructions: string } => {
  if (!source.startsWith('---\n')) return { frontmatter: {}, instructions: source.trim() };
  const end = source.indexOf('\n---', 4);
  if (end < 0) throw new BehaviorDefinitionError([{ path: 'BEHAVIOR.md', message: 'frontmatter is not closed' }]);
  const value = parse(source.slice(4, end));
  if (value != null && typeof value !== 'object') throw new BehaviorDefinitionError([{ path: 'BEHAVIOR.md', message: 'frontmatter must be an object' }]);
  return { frontmatter: (value ?? {}) as Frontmatter, instructions: source.slice(end + 4).trim() };
};

export class FileSystemBehaviorResolver implements BehaviorResolver {
  readonly root = '$root' as const;
  private constructor(readonly id: string, private readonly directory: string) {}

  static async create(directory: string, id = path.basename(directory)): Promise<FileSystemBehaviorResolver> {
    return new FileSystemBehaviorResolver(id, await fs.realpath(directory));
  }

  async resolve(id: BehaviorPath): Promise<BehaviorNode | undefined> {
    const canonical = normalizePath(id);
    const directory = await this.resolveDirectory(canonical, false);
    if (!directory) return undefined;
    let source: string;
    try { source = await fs.readFile(path.join(directory, 'BEHAVIOR.md'), 'utf8'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    const { frontmatter, instructions } = readBehaviorMarkdown(source);
    const judgeInstructions = await fs.readFile(path.join(directory, 'JUDGE.md'), 'utf8').catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    });
    const skills = await Promise.all((frontmatter.skills ?? []).map(skill => this.resolveAsset(directory, skill)));
    const stat = await fs.stat(path.join(directory, 'BEHAVIOR.md'));
    return Object.freeze({
      id: canonical,
      name: frontmatter.id ?? canonical.split('/').at(-1)!,
      version: frontmatter.version ?? `${stat.mtimeMs}:${stat.size}`,
      instructions: instructions || undefined,
      judgeInstructions,
      skills,
      tools: Object.freeze([...(frontmatter.tools ?? [])]),
      model: frontmatter.model,
      judgeModel: frontmatter.judgeModel,
      guards: Object.freeze([...(frontmatter.guards ?? [])]),
      judge: frontmatter.judge ?? Boolean(judgeInstructions),
      destinations: Object.freeze([...(frontmatter.destinations ?? [])]),
      periodic: frontmatter.periodic,
    });
  }

  async children(id: BehaviorPath): Promise<readonly BehaviorNode[]> {
    const canonical = normalizePath(id);
    const directory = await this.resolveDirectory(canonical, true);
    if (!directory) return [];
    const candidates = await this.childDirectories(directory);
    const current = await this.resolve(canonical);
    const ids = [
      ...candidates.map(candidate => this.toId(candidate)),
      ...(current?.destinations ?? []).map(destination => resolveDestination(canonical, destination)),
    ];
    const nodes = await Promise.all([...new Set(ids)].map(candidate => this.resolve(candidate)));
    return nodes.filter((node): node is BehaviorNode => Boolean(node)).sort((a, b) => a.id.localeCompare(b.id));
  }

  parent(id: BehaviorPath): BehaviorPath | undefined {
    const canonical = normalizePath(id);
    if (canonical === '$root') return undefined;
    const parts = canonical.split('/');
    parts.pop();
    if (parts.at(-1) === 'behaviors') parts.pop();
    return (parts.join('/') || '$root') as BehaviorPath;
  }

  private async childDirectories(directory: string): Promise<string[]> {
    const direct = await fs.readdir(directory, { withFileTypes: true });
    const candidates = direct.filter(entry => entry.isDirectory() && entry.name !== 'skills' && entry.name !== 'behaviors').map(entry => path.join(directory, entry.name));
    const container = path.join(directory, 'behaviors');
    const nested = await fs.readdir(container, { withFileTypes: true }).catch(error => (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : Promise.reject(error));
    candidates.push(...nested.filter(entry => entry.isDirectory()).map(entry => path.join(container, entry.name)));
    return candidates;
  }

  private async resolveDirectory(id: BehaviorPath, allowMissing: boolean): Promise<string | undefined> {
    const relative = id === '$root' ? '' : id.slice('$root/'.length);
    const candidate = path.resolve(this.directory, relative);
    const rel = path.relative(this.directory, candidate);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new BehaviorDefinitionError([{ path: id, message: 'path escapes behavior root' }]);
    try {
      const real = await fs.realpath(candidate);
      const realRel = path.relative(this.directory, real);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new BehaviorDefinitionError([{ path: id, message: 'symlink escapes behavior root' }]);
      return real;
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private async resolveAsset(directory: string, candidate: string): Promise<string> {
    if (path.isAbsolute(candidate)) throw new BehaviorDefinitionError([{ path: 'skills', message: 'absolute paths are not allowed' }]);
    const resolved = await fs.realpath(path.resolve(directory, candidate));
    const relative = path.relative(this.directory, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new BehaviorDefinitionError([{ path: 'skills', message: 'asset escapes behavior root' }]);
    return resolved;
  }

  private toId(directory: string): BehaviorPath {
    return normalizePath(`$root/${path.relative(this.directory, directory).split(path.sep).join('/')}`);
  }
}

export function createStaticBehaviorResolver(definition: NormalizedBehaviorDefinition): BehaviorResolver {
  const initial = definition.states[definition.initialState]!;
  const toPath = (stateId: string): BehaviorPath => stateId === definition.initialState ? '$root' : `$root/${stateId}`;
  const periodicDestination = (state: typeof initial): BehaviorPath | undefined => {
    if (!state.periodic) return undefined;
    const transition = state.transitions.find(candidate => candidate.id === state.periodic!.transition);
    return transition ? toPath(transition.target) : undefined;
  };
  const resolver = new InMemoryBehaviorResolver(definition.id, {
    name: initial.id,
    version: definition.version,
    instructions: initial.instructions,
    judgeInstructions: initial.judgeInstructions,
    skills: initial.skills,
    tools: initial.tools,
    model: initial.model,
    judgeModel: initial.judgeModel,
    guards: initial.transitions.flatMap(transition => transition.guards),
    judge: initial.transitions.some(transition => transition.judge),
    destinations: initial.transitions.map(transition => toPath(transition.target)),
    periodic: initial.periodic ? { intervalMs: initial.periodic.intervalMs, destination: periodicDestination(initial)! } : undefined,
  });
  for (const state of Object.values(definition.states)) {
    if (state.id === definition.initialState) continue;
    resolver.set(`$root/${state.id}` as BehaviorPath, {
      version: definition.version,
      instructions: state.instructions,
      judgeInstructions: state.judgeInstructions,
      skills: state.skills,
      tools: state.tools,
      model: state.model,
      judgeModel: state.judgeModel,
      guards: state.transitions.flatMap(transition => transition.guards),
      judge: state.transitions.some(transition => transition.judge),
      destinations: state.transitions.map(transition => toPath(transition.target)),
      periodic: state.periodic ? { intervalMs: state.periodic.intervalMs, destination: periodicDestination(state)! } : undefined,
    });
  }
  return resolver;
}
