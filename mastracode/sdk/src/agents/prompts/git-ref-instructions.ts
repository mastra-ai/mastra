/**
 * The instruction files at a session's trusted base ref, held in memory.
 *
 * Reading them is the only git work a model call needs, so it is asynchronous
 * and cached per session: a session reads the ref's tree once per checkout,
 * and again only when the checkout's refs change on disk.
 */

import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findGitDirs } from '../../utils/git-dir.js';

/**
 * File names the static prompt and the reminder channel (core's
 * `AgentsMDInjector`) look for, lowercased. A name that is not listed here
 * reads as absent at the ref.
 */
const INSTRUCTION_FILE_NAMES = new Set(['agents.md', 'claude.md', 'context.md']);

/** Larger instruction files are not served, as before. */
const MAX_INSTRUCTION_BYTES = 1024 * 1024;

/** What instruction lookup needs from one tree: its directories and its instruction files. */
interface TreeInstructions {
  dirs: Set<string>;
  /** Content by path; `null` for a file too large to serve. */
  files: Map<string, string | null>;
}

/**
 * Directories and instruction files at a ref, addressed by path relative to
 * the repository root. Each path is answered by `origin/<ref>` (remote truth)
 * when it has it, otherwise by the local ref.
 */
export interface GitRefInstructions {
  readonly ref: string;
  /** `tree` for a directory and `blob` for an instruction file; other files are not tracked. */
  typeOf(path: string): 'tree' | 'blob' | null;
  /** Content of an instruction file, `null` when the ref has none there. */
  read(path: string): string | null;
}

function runGit(
  cwd: string,
  args: string[],
  { input, onData }: { input?: string; onData?: (chunk: Buffer) => void } = {},
): Promise<Buffer | null> {
  return new Promise(done => {
    const child = spawn('git', ['-C', cwd, ...args], {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
    });
    const chunks: Buffer[] = [];
    child.stdout!.on('data', (chunk: Buffer) => (onData ? onData(chunk) : chunks.push(chunk)));
    child.once('error', () => done(null));
    child.once('close', code => done(code === 0 ? Buffer.concat(chunks) : null));
    if (input !== undefined) {
      // git may exit before reading everything; its exit code already says so.
      child.stdin!.on('error', () => {});
      child.stdin!.end(input);
    }
  });
}

/** Tree ids of `origin/<ref>` and `<ref>`, `null` for one that does not resolve; `undefined` when git could not say. */
async function resolveTrees(cwd: string, ref: string): Promise<Array<string | null> | undefined> {
  if (/[\n\0]/.test(ref)) return [null, null];
  const names = [`origin/${ref}`, ref];
  const output = await runGit(cwd, ['cat-file', '--batch-check'], {
    input: names.map(name => `${name}^{tree}\n`).join(''),
  });
  if (!output) return undefined;
  const lines = output.toString('latin1').split('\n');
  return names.map((_, index) => /^([0-9a-f]{40,64}) tree \d+$/.exec(lines[index] ?? '')?.[1] ?? null);
}

async function readTree(cwd: string, tree: string): Promise<TreeInstructions | null> {
  const dirs = new Set<string>();
  const blobs = new Map<string, string>();
  const record = (entry: Buffer) => {
    const tab = entry.indexOf(0x09);
    const type = entry.toString('latin1', 7, 11);
    if (type === 'tree') {
      dirs.add(entry.toString('utf-8', tab + 1));
    } else if (type === 'blob') {
      const path = entry.toString('utf-8', tab + 1);
      const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
      if (INSTRUCTION_FILE_NAMES.has(name)) blobs.set(path, entry.toString('latin1', 12, tab));
    }
  };
  // Entries are `<mode> <type> <id>\t<path>\0`, parsed as they arrive so a large tree never arrives as one block.
  let rest: Buffer = Buffer.alloc(0);
  const listed = await runGit(cwd, ['ls-tree', '-r', '-t', '-z', '--full-tree', tree], {
    onData: chunk => {
      const data = rest.length > 0 ? Buffer.concat([rest, chunk]) : chunk;
      let start = 0;
      for (let end = data.indexOf(0, start); end !== -1; end = data.indexOf(0, start)) {
        record(data.subarray(start, end));
        start = end + 1;
      }
      rest = data.subarray(start);
    },
  });
  if (!listed) return null;

  const contents = new Map<string, string | null>();
  if (blobs.size > 0) {
    const ids = [...new Set(blobs.values())];
    // Each object comes back as `<id> blob <size>\n<content>\n`.
    const output = await runGit(cwd, ['cat-file', '--batch'], { input: ids.map(id => `${id}\n`).join('') });
    if (!output) return null;
    let offset = 0;
    for (const id of ids) {
      const headerEnd = output.indexOf(0x0a, offset);
      if (headerEnd === -1) return null;
      const header = /^([0-9a-f]+) blob (\d+)$/.exec(output.toString('latin1', offset, headerEnd));
      if (header?.[1] !== id) return null;
      const size = Number(header[2]);
      const start = headerEnd + 1;
      contents.set(id, size > MAX_INSTRUCTION_BYTES ? null : output.toString('utf-8', start, start + size));
      offset = start + size + 1;
    }
  }
  const files = new Map<string, string | null>();
  for (const [path, id] of blobs) files.set(path, contents.get(id) ?? null);
  return { dirs, files };
}

/**
 * Trees already read, by id. A tree id names its content, so one read serves
 * every checkout at that commit. Entries are weak: a tree lives as long as a
 * session's checkout still points at it.
 */
const trees = new Map<string, WeakRef<TreeInstructions> | Promise<TreeInstructions | null>>();
const reclaimed = new FinalizationRegistry<string>(id => {
  const entry = trees.get(id);
  if (entry instanceof WeakRef && !entry.deref()) trees.delete(id);
});

function loadTree(cwd: string, id: string): Promise<TreeInstructions | null> {
  const known = trees.get(id);
  const tree = known instanceof WeakRef ? known.deref() : undefined;
  if (tree) return Promise.resolve(tree);
  if (known instanceof Promise) return known;
  const pending = readTree(cwd, id).then(read => {
    if (read) {
      trees.set(id, new WeakRef(read));
      reclaimed.register(read, id);
    } else {
      trees.delete(id);
    }
    return read;
  });
  trees.set(id, pending);
  return pending;
}

function instructionsAt(ref: string, layers: TreeInstructions[]): GitRefInstructions {
  return {
    ref,
    typeOf: path => {
      for (const layer of layers) {
        if (layer.dirs.has(path)) return 'tree';
        if (layer.files.has(path)) return 'blob';
      }
      return null;
    },
    read: path => {
      for (const layer of layers) {
        const content = layer.files.get(path);
        if (typeof content === 'string') return content;
      }
      return null;
    },
  };
}

/** `complete` is false when git failed part-way, so the answer must not be kept. */
async function readInstructions(
  projectPath: string,
  ref: string,
): Promise<{ instructions: GitRefInstructions; complete: boolean }> {
  const ids = await resolveTrees(projectPath, ref);
  if (!ids) return { instructions: instructionsAt(ref, []), complete: false };
  const unique = [...new Set(ids.filter(id => id !== null))];
  const layers = await Promise.all(unique.map(id => loadTree(projectPath, id)));
  return {
    instructions: instructionsAt(
      ref,
      layers.filter(layer => layer !== null),
    ),
    complete: layers.every(layer => layer !== null),
  };
}

/**
 * Names git resolves through refs alone. Anything else (`HEAD~2`, an object
 * id, `@{upstream}`) can change meaning without one of the files below
 * changing, so it is resolved by git every time.
 */
function isPlainRefName(ref: string): boolean {
  return (
    /^[^\0-\x20\x7f~^:?*[\\]+$/.test(ref) &&
    !/^[-/.]|[/.]$|\.\.|\/\/|\/\.|@\{|\.lock(\/|$)/.test(ref) &&
    !/^[0-9a-f]{4,}$/i.test(ref)
  );
}

/**
 * Everything on disk that decides what `origin/<ref>` and `<ref>` resolve to.
 * While it is unchanged, so is the answer git gave. `null` when only git can
 * say; `undefined` when there is no repository.
 */
async function refFingerprint(projectPath: string, ref: string): Promise<string | null | undefined> {
  const found = await findGitDirs(projectPath);
  if (found.kind === 'none') return undefined;
  if (found.kind === 'ask-git' || !isPlainRefName(ref)) return null;
  const { gitDir, commonDir } = found;
  const names = [`origin/${ref}`, ref];
  const exists = (file: string) =>
    stat(file).then(
      () => true,
      () => false,
    );
  // git tries these in order for a short name; any of them appearing or changing can change the answer.
  const [rootRefs, loose, stores] = await Promise.all([
    Promise.all(names.map(name => exists(join(gitDir, name)))),
    Promise.all(
      names
        .flatMap(name => [
          ...['refs', 'refs/tags', 'refs/heads', 'refs/remotes'].map(namespace => join(commonDir, namespace, name)),
          join(commonDir, 'refs/remotes', name, 'HEAD'),
        ])
        .map(file => readFile(file, 'utf-8').catch(() => '')),
    ),
    Promise.all(
      ['packed-refs', 'reftable/tables.list'].map(file =>
        stat(join(commonDir, file), { bigint: true }).then(
          stats => `${stats.ino}:${stats.size}:${stats.mtimeNs}`,
          () => '',
        ),
      ),
    ),
  ]);
  // A file at the top of the git directory (`HEAD`) or a symbolic ref follows state not read here.
  if (rootRefs.some(Boolean) || loose.some(content => content.startsWith('ref:'))) return null;
  return [gitDir, ...loose, ...stores].join('\n');
}

/**
 * Load the instruction files at `ref` for the checkout at `projectPath`,
 * asking git each time. A path outside any repository has none.
 */
export async function loadGitRefInstructions(projectPath: string, ref: string): Promise<GitRefInstructions> {
  if ((await refFingerprint(projectPath, ref)) === undefined) return instructionsAt(ref, []);
  return (await readInstructions(projectPath, ref)).instructions;
}

/**
 * One session's base-ref instructions. A repeated `load` starts no git process
 * until the checkout's refs change on disk. Dropping the cache with its
 * session is what frees it.
 */
export class GitRefInstructionsCache {
  readonly #checkouts = new Map<string, { fingerprint: string; instructions: Promise<GitRefInstructions> }>();

  async load(projectPath: string, ref: string): Promise<GitRefInstructions> {
    const fingerprint = await refFingerprint(projectPath, ref);
    if (fingerprint === undefined) return instructionsAt(ref, []);
    if (fingerprint === null) return (await readInstructions(projectPath, ref)).instructions;

    const key = `${projectPath}\0${ref}`;
    const known = this.#checkouts.get(key);
    if (known?.fingerprint === fingerprint) return known.instructions;
    const read = readInstructions(projectPath, ref);
    const fresh = { fingerprint, instructions: read.then(result => result.instructions) };
    this.#checkouts.set(key, fresh);
    const { complete } = await read;
    if (!complete && this.#checkouts.get(key) === fresh) this.#checkouts.delete(key);
    return fresh.instructions;
  }
}
