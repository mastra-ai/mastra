import type { InputLimits } from '../contracts/limits.ts';
import { sha256, IntakeFailure } from '../intake/source.ts';
import type { InputSourceSnapshot } from '../intake/source.ts';

export function sourceStatement(s: InputSourceSnapshot, limits: InputLimits) {
  if (s.sizeBytes > limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', s.sourceId);
  if (s.sizeBytes !== s.bytes.length || s.sha256 !== sha256(s.bytes)) throw new Error('Source snapshot mismatch.');
  return {
    sql: 'INSERT OR IGNORE INTO vrq_sources (digest, source_id, original_name, size_bytes, bytes) VALUES (?, ?, ?, ?, ?)',
    args: [s.sha256, s.sourceId, s.originalName, s.sizeBytes, s.bytes],
  };
}
