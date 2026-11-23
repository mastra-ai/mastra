import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { findNpm } from '../install.js';

export interface FixturePackage {
  name: string;
  version: string;
  /** Files besides package.json, e.g. `{ 'index.mjs': '…' }`. */
  files: Record<string, string>;
  /** Extra package.json fields (main, exports, dependencies…). */
  manifest?: Record<string, unknown>;
}

export interface LocalRegistry {
  url: string;
  /** Tarball and packument requests the registry answered, in order. */
  requests: string[];
  close: () => Promise<void>;
}

/** Packs a fixture with the real `npm pack`. */
function pack(pkg: FixturePackage, workDir: string): Buffer {
  const dir = fs.mkdtempSync(path.join(workDir, 'pkg-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: pkg.name, version: pkg.version, type: 'module', ...pkg.manifest }),
  );
  for (const [file, content] of Object.entries(pkg.files)) fs.writeFileSync(path.join(dir, file), content);
  const npm = findNpm();
  const out = execFileSync(npm.command, [...npm.args, 'pack', '--json', '--pack-destination', dir], {
    cwd: dir,
    encoding: 'utf8',
  });
  const [{ filename }] = JSON.parse(out) as [{ filename: string }];
  return fs.readFileSync(path.join(dir, filename));
}

/**
 * A minimal npm registry over real HTTP: serves packuments and tarballs for the given fixtures and 404s
 * everything else. npm talks to it exactly as it would to registry.npmjs.org.
 */
export async function startLocalRegistry(packages: FixturePackage[]): Promise<LocalRegistry> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-registry-'));
  const tarballs = new Map<string, Buffer>();
  const byName = new Map<string, FixturePackage[]>();
  for (const pkg of packages) {
    tarballs.set(`${pkg.name}@${pkg.version}`, pack(pkg, workDir));
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }

  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url ?? '/');
    requests.push(url);
    const tarball = /^\/-\/tarball\/(.+)$/.exec(url);
    if (tarball) {
      const body = tarballs.get(tarball[1]!);
      if (!body) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(body);
      return;
    }
    const versions = byName.get(url.slice(1));
    if (!versions) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}');
      return;
    }
    const base = `http://${req.headers.host}`;
    const packument = {
      name: versions[0]!.name,
      'dist-tags': { latest: versions.at(-1)!.version },
      versions: Object.fromEntries(
        versions.map(pkg => {
          const body = tarballs.get(`${pkg.name}@${pkg.version}`)!;
          return [
            pkg.version,
            {
              name: pkg.name,
              version: pkg.version,
              ...pkg.manifest,
              dist: {
                tarball: `${base}/-/tarball/${pkg.name}@${pkg.version}`,
                integrity: `sha512-${createHash('sha512').update(body).digest('base64')}`,
                shasum: createHash('sha1').update(body).digest('hex'),
              },
            },
          ];
        }),
      ),
    };
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(packument));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
        fs.rmSync(workDir, { recursive: true, force: true });
      }),
  };
}

/** A port nothing listens on, for "registry unreachable". */
export async function closedPortUrl(): Promise<string> {
  const server = http.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise(resolve => server.close(resolve));
  return `http://127.0.0.1:${port}/`;
}

/**
 * npm environment for a test: its own empty cache and user config, so nothing installed earlier on this
 * machine (or a user `.npmrc`) changes what the test sees.
 */
export function isolatedNpmEnv(): { env: Record<string, string>; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-npm-'));
  const userconfig = path.join(dir, 'npmrc');
  fs.writeFileSync(userconfig, '');
  return {
    env: {
      npm_config_cache: path.join(dir, 'cache'),
      npm_config_userconfig: userconfig,
      npm_config_fetch_retries: '0',
      npm_config_fetch_timeout: '5000',
      npm_config_update_notifier: 'false',
    },
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
