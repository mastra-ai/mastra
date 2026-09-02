// Circle's skills install by cloning a git repository, and the image this deploys to has no git.
//
// `npx skills add circlefin/skills -g` — the universal fallback Circle's setup document publishes,
// and the one this template steers the agent towards — spawns `git` and dies with `ENOENT`.
// `circle skill install` is not a second path: it shells out to the same command. So on a
// container with node, npm and tar and nothing else, both documented routes fail.
//
// The failure is quiet, which is what makes it worth handling here. Circle's setup document says
// to carry on to the login step if the install errors, so the agent does, and setup *appears* to
// finish: Terms accepted, session live, wallet reachable. But `hasSkills()` — the question "has
// setup run?" reduces to — reads a directory that was never written, so it answers no on every
// request afterwards, and the bootstrap line stays in the system prompt forever. The user gets the
// entire setup sweep in front of every "hello", in a warm container, with nothing wrong that they
// can see.
//
// So the install is done here instead, from the tarball GitHub serves for the same commit the
// clone would have fetched. Nothing about the content changes: these are Circle's skills, at
// Circle's published head, laid out where the workspace reads them. What changes is that it does
// not need a binary the image does not ship.
//
// This runs only when `git` is genuinely absent. With git on the machine — every laptop — the
// command goes to the shell exactly as before and this file does nothing.

import { execFile } from 'node:child_process';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** The archive of the same tree `git clone` would have produced. `HEAD` so the branch can be renamed. */
const TARBALL = 'https://codeload.github.com/circlefin/skills/tar.gz/HEAD';

/** Where the skills sit inside that archive, below the one top-level directory GitHub adds. */
const SKILLS_PATH = ['plugins', 'circle', 'skills'];

/** Comfortably larger than the ~850KB Circle publishes, and a stop on a repository that grows. */
const MAX_BYTES = 16 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 60_000;

/**
 * Whether the skills registry has a `git` to spawn.
 *
 * Asked once per process and remembered: it is a property of the image, it cannot change under a
 * running server, and the alternative is spawning a process on every blocked command.
 */
let gitProbe: Promise<boolean> | undefined;

export function gitAvailable(): Promise<boolean> {
  gitProbe ??= run('git', ['--version'], { timeout: 5_000 }).then(
    () => true,
    () => false,
  );

  return gitProbe;
}

/**
 * Whether a command is trying to install Circle's skills.
 *
 * Both spellings, because both reach the same clone: the `npx` fallback the setup document calls
 * universal, and `circle skill install`, which runs it for you. The `npx` form is matched only for
 * Circle's own repository — a command installing somebody else's skills is not this file's
 * business.
 */
export function installsCircleSkills(command: string): boolean {
  const single = command.trim();

  if (/\bcircle\s+skill\s+install\b/.test(single)) return true;

  return /\bskills\s+add\b/.test(single) && /\bcirclefin\/skills\b/.test(single);
}

/** The single directory GitHub wraps an archive in, whatever the branch is called. */
async function topLevel(staging: string): Promise<string | undefined> {
  const entries = await readdir(staging, { withFileTypes: true });
  const dirs = entries.filter(entry => entry.isDirectory());

  return dirs.length === 1 ? dirs[0]!.name : undefined;
}

/**
 * Install Circle's skills into `destination`, or report that it could not be done.
 *
 * Returns `undefined` on any failure rather than throwing, so the caller can let the original
 * command run and fail on its own terms. A blocked command that explains itself is better than one
 * silently replaced by an error from a mechanism the agent was never told about.
 *
 * Staged inside the destination's own parent, not `/tmp`: the last step is a rename, and a rename
 * across two filesystems is not a rename at all.
 */
export async function installCircleSkills(destination: string): Promise<string | undefined> {
  const staging = join(dirname(destination), '.circle-skills-download');

  try {
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    await mkdir(destination, { recursive: true });

    const response = await fetch(TARBALL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return undefined;

    const archive = Buffer.from(await response.arrayBuffer());
    if (archive.byteLength === 0 || archive.byteLength > MAX_BYTES) return undefined;

    const tarball = join(staging, 'skills.tar.gz');
    await writeFile(tarball, archive);
    await run('tar', ['-xzf', tarball, '-C', staging], { timeout: 60_000 });

    const root = await topLevel(staging);
    if (!root) return undefined;

    const source = join(staging, root, ...SKILLS_PATH);
    const skills = (await readdir(source, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    if (skills.length === 0) return undefined;

    for (const skill of skills) {
      const target = join(destination, skill);
      // Replaced rather than merged: a skill left half-written by an earlier attempt must not
      // survive underneath a good copy of itself.
      await rm(target, { recursive: true, force: true });
      await rename(join(source, skill), target);
    }

    return (
      `Installed ${skills.length} Circle skills into ${destination}:\n` +
      skills.map(skill => `  - ${skill}`).join('\n') +
      '\n\nThis machine has no `git`, so the registry could not clone; the same skills were taken ' +
      "from Circle's published archive instead. They are installed and ready — do not run the " +
      'install again, and carry on with the setup from the next step.'
    );
  } catch {
    return undefined;
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}
