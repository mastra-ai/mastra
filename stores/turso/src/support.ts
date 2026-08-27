import { familySync, GLIBC, MUSL } from 'detect-libc';

export type TursoLinuxLibc = 'glibc' | 'musl' | 'unknown';

export interface TursoDatabaseSupportOptions {
  platform?: NodeJS.Platform;
  arch?: string;
  linuxLibc?: TursoLinuxLibc;
}

export interface TursoDatabaseSupport {
  supported: boolean;
  platform: NodeJS.Platform;
  arch: string;
  linuxLibc?: TursoLinuxLibc;
  reason?: string;
}

function detectLinuxLibc(): TursoLinuxLibc {
  const family = familySync();
  if (family === GLIBC) return 'glibc';
  if (family === MUSL) return 'musl';
  return 'unknown';
}

export function getTursoDatabaseSupport(options: TursoDatabaseSupportOptions = {}): TursoDatabaseSupport {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;

  if (platform === 'darwin' && arch === 'arm64') return { supported: true, platform, arch };
  if (platform === 'win32' && arch === 'x64') return { supported: true, platform, arch };

  if (platform === 'linux') {
    const linuxLibc = options.linuxLibc ?? detectLinuxLibc();
    const supported = (arch === 'x64' || arch === 'arm64') && linuxLibc === 'glibc';
    return {
      supported,
      platform,
      arch,
      linuxLibc,
      ...(supported
        ? {}
        : { reason: `Turso Database requires Linux x64 or arm64 with glibc; detected ${arch}/${linuxLibc}.` }),
    };
  }

  return {
    supported: false,
    platform,
    arch,
    reason: `Turso Database does not provide a native binding for ${platform}/${arch}.`,
  };
}
