import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';

export const SECCOMP_FILE_SHA256 = '98d113cc082a550ffda5dc42c3a638a0a0326dc6a9fe2385f15eea3976fea53f';
export const SECCOMP_POLICY_SHA256 = '46586788a72b5956ec642d23f54ae586c7efebd71e72cfcc6068f144e112f771';

export function policyDigest(serialized: string) {
  return createHash('sha256').update(serialized).digest('hex');
}

/** Load and verify the bounded pinned seccomp policy for the selected runtime platform. */
export function loadSandboxPolicy(settings: Pick<Settings, 'root'>) {
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(settings.root, 'docker', 'discovery', 'seccomp.json'));
  } catch {
    throw new RuntimeDiagnostic(
      'RUNTIME_POLICY_UNAVAILABLE',
      'Restore the bundled docker/discovery/seccomp.json before setup.',
    );
  }
  if (createHash('sha256').update(bytes).digest('hex') !== SECCOMP_FILE_SHA256) {
    throw new RuntimeDiagnostic(
      'RUNTIME_POLICY_MISMATCH',
      'The bundled sandbox policy failed its integrity check. Restore the distributed policy.',
    );
  }
  const profile = JSON.parse(bytes.toString('utf8'));
  const serialized = JSON.stringify(profile);
  if (policyDigest(serialized) !== SECCOMP_POLICY_SHA256) {
    throw new RuntimeDiagnostic(
      'RUNTIME_POLICY_MISMATCH',
      'The bundled sandbox policy does not match the pinned policy.',
    );
  }
  return { profile, serialized, fileSha256: SECCOMP_FILE_SHA256, policySha256: SECCOMP_POLICY_SHA256 };
}

/** Compare observed seccomp state with the policy required for the running sandbox. */
export function inspectAppliedPolicy(securityOptions: string[] | undefined) {
  const options = securityOptions?.filter(option => option.startsWith('seccomp=')) ?? [];
  let digest: string | undefined;
  if (options.length === 1 && options[0]!.length <= 65536) {
    try {
      digest = policyDigest(JSON.stringify(JSON.parse(options[0]!.slice('seccomp='.length))));
    } catch {
      /* Invalid policies fail closed below. */
    }
  }
  if (digest !== SECCOMP_POLICY_SHA256) {
    throw new RuntimeDiagnostic('APPLIED_POLICY_MISMATCH', 'Docker did not apply the pinned sandbox policy.');
  }
  return digest;
}
