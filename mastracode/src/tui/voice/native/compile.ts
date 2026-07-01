/**
 * Lazily build the bundled macOS STT Swift recognizer into a cached `.app` bundle.
 *
 * On first use we `swiftc`-compile `macos-stt.swift` into `Contents/MacOS/` of a
 * `.app` bundle written to the cache dir, alongside a generated `Contents/Info.plist`
 * (derived from `macos-stt.plist`). The bundle is keyed by a hash of the script
 * source + the Info.plist source so a change to either rebuilds. If a cached
 * bundle already exists it is reused (fast path).
 *
 * Why a `.app` bundle and not a loose binary: macOS only shows the Speech
 * Recognition / Microphone TCC permission prompts for a process launched as a
 * bundled app through LaunchServices (`open`). A bare CLI executable — even one
 * with the Info.plist embedded in its `__info_plist` Mach-O section and ad-hoc
 * signed — never triggers the `SFSpeechRecognizer.requestAuthorization` callback;
 * macOS silently denies and the recognizer aborts. A real `.app` with an
 * `Info.plist` carrying the usage strings, ad-hoc signed and launched via `open`,
 * is the only reliable way to get the prompt to appear and access to be granted.
 *
 * The bundle's binary is also usable directly (not via `open`) for `--probe`,
 * which only reads authorization status and does not touch protected APIs.
 *
 * Compilation is async and never blocks the event loop; callers await it before
 * launching the recognizer.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve a native asset (the Swift recognizer or its plist) at runtime.
 *
 * In dev (tsx) the assets sit next to this source file. In a built CLI the JS is
 * bundled into a chunk under `dist/`, so the assets are copied to `dist/native/`
 * by tsup. We probe both layouts plus a couple of nearby fallbacks so the
 * recognizer resolves regardless of how mastracode was launched.
 */
function resolveAsset(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, name), // dev: src/tui/voice/native/<name>
    join(here, 'native', name), // bundled chunk sitting beside dist/native/
    join(here, '..', 'native', name),
    join(here, '..', '..', 'native', name),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Fall back to the dev-layout path so the eventual readFile error is clear.
  return join(here, name);
}

const SCRIPT_PATH = resolveAsset('macos-stt.swift');
const PLIST_PATH = resolveAsset('macos-stt.plist');

/** The bundle name and the executable inside it. */
const APP_NAME = 'MastraCodeVoice';
const BUNDLE_ID = 'ai.mastra.mastracode.voice';

/** How to launch the recognizer. */
export interface RecognizerInvocation {
  /** Path to the `.app` bundle, launched via `open` for recording (TCC prompt). */
  appPath: string;
  /** Path to the executable inside the bundle, run directly for `--probe`. */
  binaryPath: string;
}

function cacheDir(): string {
  const base = process.env.XDG_CACHE_HOME?.trim() || join(homedir(), 'Library', 'Caches');
  return join(base, 'mastracode', 'voice');
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function hasSwiftc(): Promise<boolean> {
  return runOk('swiftc', ['--version']);
}

function runOk(command: string, args: string[]): Promise<boolean> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}

function compile(scriptPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('swiftc', ['-O', scriptPath, '-o', outPath], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`swiftc exited with code ${code}`));
    });
  });
}

/**
 * Ad-hoc sign the `.app` bundle. The bundle's `Info.plist` (with the TCC usage
 * strings) is sealed into the signature, which is what lets macOS read the
 * strings and present the permission prompt when the app is launched via `open`.
 */
function adhocSign(appPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('codesign', ['-f', '-s', '-', '-i', BUNDLE_ID, appPath], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`codesign exited with code ${code}`));
    });
  });
}

/**
 * Build the bundle's `Info.plist` from the checked-in plist source, adding the
 * `.app` bundle keys (`CFBundleExecutable`, `CFBundlePackageType`) that a real
 * bundle requires on top of the usage-description strings.
 */
function buildInfoPlist(source: string): string {
  // The source plist already carries CFBundleIdentifier/Name + usage strings.
  // Inject the executable + package-type keys right after the opening <dict>.
  const extras = [
    '  <key>CFBundleExecutable</key>',
    `  <string>${APP_NAME}</string>`,
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>LSUIElement</key>',
    '  <true/>',
  ].join('\n');
  if (source.includes('<key>CFBundleExecutable</key>')) return source;
  return source.replace('<dict>', `<dict>\n${extras}`);
}

/**
 * Write the `.app` bundle layout: `Contents/Info.plist` + `Contents/MacOS/<exe>`.
 * The Swift binary is compiled straight into `Contents/MacOS/`.
 */
async function buildBundle(scriptPath: string, plistSource: string, appPath: string): Promise<void> {
  // Rebuild from scratch so a stale partial bundle never lingers.
  await rm(appPath, { recursive: true, force: true });
  const macosDir = join(appPath, 'Contents', 'MacOS');
  await mkdir(macosDir, { recursive: true });
  await writeFile(join(appPath, 'Contents', 'Info.plist'), buildInfoPlist(plistSource), 'utf8');
  await compile(scriptPath, join(macosDir, APP_NAME));
  await adhocSign(appPath);
}

/**
 * Resolve how to launch the recognizer, building+caching the `.app` bundle on
 * first use.
 *
 * Returns `null` when `swiftc` is unavailable or the build fails — the caller
 * surfaces a clear "install Xcode command line tools" message.
 */
export async function resolveRecognizer(
  scriptPath: string = SCRIPT_PATH,
  plistPath: string = PLIST_PATH,
): Promise<RecognizerInvocation | null> {
  let source: string;
  let plist: string;
  try {
    [source, plist] = await Promise.all([readFile(scriptPath, 'utf8'), readFile(plistPath, 'utf8')]);
  } catch {
    // Native assets aren't shipped/readable — treat as "native unavailable".
    return null;
  }
  // `v3` busts caches built before the .app-bundle + LaunchServices approach
  // (loose binaries never triggered the TCC prompt).
  const hash = createHash('sha256').update('v3').update(source).update('\0').update(plist).digest('hex').slice(0, 16);
  const dir = cacheDir();
  const appPath = join(dir, `macos-stt-${hash}.app`);
  const binaryPath = join(appPath, 'Contents', 'MacOS', APP_NAME);

  if (await exists(binaryPath)) {
    return { appPath, binaryPath };
  }

  if (!(await hasSwiftc())) {
    return null;
  }

  await mkdir(dir, { recursive: true });
  try {
    await buildBundle(scriptPath, plist, appPath);
  } catch {
    return null;
  }
  return { appPath, binaryPath };
}

/** Directory used to cache compiled recognizer bundles (exported for tests). */
export function recognizerCacheDir(): string {
  return cacheDir();
}

export { SCRIPT_PATH, PLIST_PATH };
