import { createHash } from 'node:crypto';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX } from './types';
import type { MountContext } from './types';

export function s3CredentialsPrefix(mountPath: string): string {
  return `/tmp/.mastra-s3-${createHash('sha256').update(mountPath.replace(/\/$/, '')).digest('hex')}-`;
}

/** Remove credentials only after their s3fs process has exited, including after reconnects. */
export async function cleanupS3Credentials(
  mountPath: string,
  ctx: Pick<MountContext, 'run' | 'logger'>,
): Promise<void> {
  // The path hash associates each attempt with its original mount, even if recovery moved it.
  // Inspect processes, not just /proc/mounts: lazy unmount can leave a daemon using the file.
  const script = `test -r /proc/self/comm || exit 1
credentials_in_use() {
  for process in /proc/[0-9]*; do
    test -d "$process" || continue
    name=$(cat "$process/comm" 2>/dev/null) || {
      test -d "$process" && return 0
      continue
    }
    test "$name" = s3fs || continue
    args=$(tr '\\000' '\\n' < "$process/cmdline") || {
      test -d "$process" && return 0
      continue
    }
    printf '%s\\n' "$args" | grep -Fxq -- "passwd_file=$directory/credentials" && return 0
  done
  return 1
}
result=0
for directory in ${shellQuote(s3CredentialsPrefix(mountPath))}*; do
  test -d "$directory" && test ! -L "$directory" || continue
  attempt=0
  while credentials_in_use && test "$attempt" -lt 20; do
    sleep 0.25
    attempt=$((attempt + 1))
  done
  if credentials_in_use; then
    result=1
    continue
  fi
  rm -f -- "$directory/credentials" && rmdir -- "$directory" || result=1
done
exit "$result"`;
  try {
    const result = await ctx.run(`sh -c ${shellQuote(script)}`, 30_000);
    if (result.exitCode !== 0) {
      ctx.logger.warn(`${LOG_PREFIX} S3 credentials retained: daemon still active or cleanup could not be verified`);
    }
  } catch {
    ctx.logger.warn(`${LOG_PREFIX} Could not clean up S3 credentials`);
  }
}
