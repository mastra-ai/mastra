/**
 * Build progress for `DockerTemplate.build()`.
 *
 * The daemon reports build progress as newline-delimited JSON. The legacy
 * builder sends plain text (`{stream: "Step 2/5 : RUN ..."}`); BuildKit sends
 * `{id: 'moby.buildkit.trace', aux: <base64 StatusResponse protobuf>}`. This
 * module normalizes both into {@link DockerTemplateBuildEvent}s and keeps a
 * bounded tail of raw output for failure diagnostics.
 */
import { StringDecoder } from 'node:string_decoder';

/** One build step (a Dockerfile instruction, or a BuildKit vertex). */
export interface DockerTemplateBuildStep {
  /** Legacy builder: the step number as a string. BuildKit: the vertex digest. */
  id: string;
  /** The instruction as reported by the builder, e.g. `RUN npm install`. */
  name: string;
  /** 1-based position (legacy builder only). */
  index?: number;
  /** Total number of steps (legacy builder only). */
  total?: number;
  /**
   * Whether the step was reused from the daemon's layer cache. `undefined`
   * when the builder did not say (e.g. `FROM` steps).
   */
  cached?: boolean;
}

/**
 * Progress event delivered to `DockerTemplateBuildOptions.onProgress`.
 *
 * `output.text` is raw command output from the build and may contain anything
 * a step prints — including secret values echoed by a `runWithSecrets`
 * command. Redact it before logging or persisting.
 */
export type DockerTemplateBuildEvent =
  /** An image with the template's tag already exists; no build ran. */
  | { type: 'reused'; templateId: string }
  /** A `docker build` is starting. */
  | { type: 'build-start'; templateId: string; builder: 'legacy' | 'buildkit' }
  | { type: 'step-start'; step: DockerTemplateBuildStep }
  /** `error` is set when this step failed. */
  | { type: 'step-complete'; step: DockerTemplateBuildStep; error?: string }
  /** Raw output, attributed to a step when the builder says which one. */
  | { type: 'output'; stepId?: string; text: string }
  | { type: 'build-complete'; status: 'ready' | 'failed' };

export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

/** Keeps at most `maxBytes` (UTF-8) of the most recent text. */
export class BoundedTail {
  readonly #maxBytes: number;
  #chunks: Buffer[] = [];
  #bytes = 0;
  #truncated = false;

  constructor(maxBytes: number) {
    this.#maxBytes = maxBytes;
  }

  get truncated(): boolean {
    return this.#truncated;
  }

  push(text: string): void {
    if (text.length === 0) return;
    let chunk = Buffer.from(text, 'utf8');
    if (chunk.length > this.#maxBytes) {
      chunk = chunk.subarray(chunk.length - this.#maxBytes);
      this.#chunks = [];
      this.#bytes = 0;
      this.#truncated = true;
    }
    this.#chunks.push(chunk);
    this.#bytes += chunk.length;
    while (this.#bytes > this.#maxBytes) {
      const head = this.#chunks[0]!;
      const excess = this.#bytes - this.#maxBytes;
      this.#truncated = true;
      if (head.length <= excess) {
        this.#chunks.shift();
        this.#bytes -= head.length;
      } else {
        this.#chunks[0] = head.subarray(excess);
        this.#bytes -= excess;
      }
    }
  }

  toString(): string {
    let text = Buffer.concat(this.#chunks).toString('utf8');
    // Dropping bytes from the front can split a multibyte character.
    if (this.#truncated) text = text.replace(/^\uFFFD+/, '');
    return text;
  }
}

// ---------------------------------------------------------------------------
// BuildKit status decoding. Only the fields we surface (moby/buildkit
// api/services/control/control.proto):
//
//   message StatusResponse { repeated Vertex vertexes = 1; repeated VertexStatus statuses = 2;
//                            repeated VertexLog logs = 3; ... }
//   message Vertex    { string digest = 1; repeated string inputs = 2; string name = 3;
//                       bool cached = 4; Timestamp started = 5; Timestamp completed = 6;
//                       string error = 7; ... }
//   message VertexLog { string vertex = 1; Timestamp timestamp = 2; int64 stream = 3; bytes msg = 4; }
// ---------------------------------------------------------------------------

export interface BuildkitVertex {
  digest: string;
  name?: string;
  cached: boolean;
  started: boolean;
  completed: boolean;
  error?: string;
}

export interface BuildkitLog {
  vertex: string;
  data: Buffer;
}

interface ProtoField {
  field: number;
  /** Varint value (wire type 0) or bytes (wire type 2); other wire types are skipped. */
  value: number | Buffer;
}

function readFields(buffer: Buffer): ProtoField[] {
  const fields: ProtoField[] = [];
  let offset = 0;
  const readVarint = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (offset >= buffer.length) throw new Error('truncated varint');
      const byte = buffer[offset++]!;
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
  };
  while (offset < buffer.length) {
    const key = readVarint();
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    switch (wireType) {
      case 0:
        fields.push({ field, value: readVarint() });
        break;
      case 1:
        offset += 8;
        break;
      case 5:
        offset += 4;
        break;
      case 2: {
        const length = readVarint();
        if (offset + length > buffer.length) throw new Error('truncated field');
        fields.push({ field, value: buffer.subarray(offset, offset + length) });
        offset += length;
        break;
      }
      default:
        throw new Error(`unsupported protobuf wire type ${wireType}`);
    }
  }
  return fields;
}

/** @internal exported for tests. Throws on malformed input. */
export function decodeBuildkitStatus(aux: string): { vertexes: BuildkitVertex[]; logs: BuildkitLog[] } {
  const vertexes: BuildkitVertex[] = [];
  const logs: BuildkitLog[] = [];
  for (const { field, value } of readFields(Buffer.from(aux, 'base64'))) {
    if (!Buffer.isBuffer(value)) continue;
    if (field === 1) {
      const vertex: BuildkitVertex = { digest: '', cached: false, started: false, completed: false };
      for (const f of readFields(value)) {
        if (f.field === 1 && Buffer.isBuffer(f.value)) vertex.digest = f.value.toString('utf8');
        else if (f.field === 3 && Buffer.isBuffer(f.value)) vertex.name = f.value.toString('utf8');
        else if (f.field === 4) vertex.cached = f.value !== 0;
        else if (f.field === 5) vertex.started = true;
        else if (f.field === 6) vertex.completed = true;
        else if (f.field === 7 && Buffer.isBuffer(f.value) && f.value.length > 0) {
          vertex.error = f.value.toString('utf8');
        }
      }
      if (vertex.digest) vertexes.push(vertex);
    } else if (field === 3) {
      let vertex = '';
      let data: Buffer = Buffer.alloc(0);
      for (const f of readFields(value)) {
        if (f.field === 1 && Buffer.isBuffer(f.value)) vertex = f.value.toString('utf8');
        else if (f.field === 4 && Buffer.isBuffer(f.value)) data = f.value;
      }
      logs.push({ vertex, data });
    }
  }
  return { vertexes, logs };
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

export interface BuildEventNormalizer {
  /** Feed one raw daemon progress object. Never throws. */
  handle(raw: unknown): void;
  /** Close any step still open after a successful build. */
  finish(): void;
  /** The first error the daemon reported, with the step it is attributed to. */
  failure(): { message: string; step?: DockerTemplateBuildStep } | undefined;
}

const LEGACY_STEP = /^Step (\d+)\/(\d+) : (.*)$/;

export function createBuildEventNormalizer(
  emit: (event: DockerTemplateBuildEvent) => void,
  tail: BoundedTail,
): BuildEventNormalizer {
  let failure: { message: string; step?: DockerTemplateBuildStep } | undefined;
  let failedStep: DockerTemplateBuildStep | undefined;

  // Legacy builder state.
  let legacyStep: DockerTemplateBuildStep | undefined;
  let legacyCached: boolean | undefined;
  let pending = '';

  // BuildKit state.
  const vertexes = new Map<string, { step: DockerTemplateBuildStep; started: boolean; completed: boolean }>();
  const decoders = new Map<string, StringDecoder>();

  const output = (text: string, stepId: string | undefined) => {
    if (!text) return;
    tail.push(text);
    emit({ type: 'output', ...(stepId !== undefined && { stepId }), text });
  };

  const completeLegacyStep = (error?: string) => {
    if (!legacyStep) return;
    const step = { ...legacyStep, ...(legacyCached !== undefined && { cached: legacyCached }) };
    if (error !== undefined) failedStep = step;
    emit({ type: 'step-complete', step, ...(error !== undefined && { error }) });
    legacyStep = undefined;
    legacyCached = undefined;
  };

  const handleLegacyLine = (line: string) => {
    const match = LEGACY_STEP.exec(line.replace(/\r?\n$/, ''));
    if (match) {
      completeLegacyStep();
      legacyStep = { id: match[1]!, name: match[3]!, index: Number(match[1]), total: Number(match[2]) };
      emit({ type: 'step-start', step: { ...legacyStep } });
      return;
    }
    if (legacyStep) {
      const trimmed = line.trim();
      if (trimmed === '---> Using cache') legacyCached = true;
      else if (trimmed.startsWith('---> Running in ') && legacyCached === undefined) legacyCached = false;
    }
    output(line, legacyStep?.id);
  };

  const handleLegacyStream = (text: string) => {
    // Step headers are matched per line; chunks are not guaranteed to be line-aligned.
    pending += text;
    let newline = pending.indexOf('\n');
    while (newline !== -1) {
      handleLegacyLine(pending.slice(0, newline + 1));
      pending = pending.slice(newline + 1);
      newline = pending.indexOf('\n');
    }
  };

  const flushLegacy = () => {
    if (pending) {
      handleLegacyLine(pending);
      pending = '';
    }
  };

  const handleBuildkit = (aux: string) => {
    const { vertexes: updates, logs } = decodeBuildkitStatus(aux);
    for (const update of updates) {
      let state = vertexes.get(update.digest);
      if (!state) {
        state = { step: { id: update.digest, name: update.name ?? '' }, started: false, completed: false };
        vertexes.set(update.digest, state);
      }
      if (update.name && !state.step.name) state.step.name = update.name;
      if (update.cached) state.step.cached = true;
      if (state.step.name.startsWith('[internal]')) continue;
      if (!state.started && (update.started || update.completed || update.cached || update.error)) {
        state.started = true;
        emit({ type: 'step-start', step: { ...state.step } });
      }
      if (!state.completed && (update.completed || update.error)) {
        state.completed = true;
        if (state.step.cached === undefined) state.step.cached = false;
        const step = { ...state.step };
        if (update.error) failedStep = step;
        emit({ type: 'step-complete', step, ...(update.error && { error: update.error }) });
      }
    }
    for (const log of logs) {
      if (vertexes.get(log.vertex)?.step.name.startsWith('[internal]')) continue;
      let decoder = decoders.get(log.vertex);
      if (!decoder) {
        decoder = new StringDecoder('utf8');
        decoders.set(log.vertex, decoder);
      }
      output(decoder.write(log.data), log.vertex || undefined);
    }
  };

  const handleError = (raw: Record<string, unknown>) => {
    const detail = raw.errorDetail as { message?: unknown } | undefined;
    const message = String(detail?.message ?? raw.error ?? 'docker build failed');
    flushLegacy();
    completeLegacyStep(message);
    if (!failure) failure = { message, ...(failedStep && { step: failedStep }) };
  };

  return {
    handle(raw) {
      if (!raw || typeof raw !== 'object') return;
      const event = raw as Record<string, unknown>;
      try {
        if (event.error !== undefined || event.errorDetail !== undefined) {
          handleError(event);
        } else if (event.id === 'moby.buildkit.trace' && typeof event.aux === 'string') {
          handleBuildkit(event.aux);
        } else if (typeof event.stream === 'string') {
          handleLegacyStream(event.stream);
        }
      } catch {
        // An unexpected progress shape must never fail the build.
      }
    },
    finish() {
      flushLegacy();
      completeLegacyStep();
    },
    failure: () => failure,
  };
}
