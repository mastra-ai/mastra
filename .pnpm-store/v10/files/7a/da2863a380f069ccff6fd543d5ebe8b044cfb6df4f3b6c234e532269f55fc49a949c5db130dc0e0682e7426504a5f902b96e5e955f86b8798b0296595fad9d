import crypto from "node:crypto";

type TraceId = string; // u128
type SpanId = string; // u64

type Nanoseconds = bigint;

// base64 URL encoded little endian
type SerializedNanoseconds = string;

export class Reporter {
  spans: CompletedSpan[] = [];

  emit(span: CompletedSpan) {
    this.spans.push(span);
  }
}

type EventRecord = {
  name: string;
  timestampUnixNs: Nanoseconds;
  properties: Record<string, string>;
};

export class Span {
  private properties: Record<string, string> = {};
  private events: EventRecord[] = [];

  private constructor(
    private reporter: Reporter | undefined,
    private traceId: TraceId,
    private parentId: SpanId,
    private spanId: SpanId,
    private beginTimeUnixNs: Nanoseconds,
    private name: string,
  ) {}

  static noop() {
    return new Span(
      undefined,
      randomTraceId(),
      randomSpanId(),
      randomSpanId(),
      unixTimeNs(),
      "",
    );
  }

  static root(reporter: Reporter, name: string) {
    const traceId = randomTraceId();
    const parentId = emptySpanId();
    const spanId = randomSpanId();
    const beginTimeUnixNs = unixTimeNs();
    return new Span(reporter, traceId, parentId, spanId, beginTimeUnixNs, name);
  }

  setProperty(key: string, value: string) {
    this.properties[key] = value;
  }

  childSpan(name: string): Span {
    const spanId = randomSpanId();
    const beginTimeUnixNs = unixTimeNs();
    return new Span(
      this.reporter,
      this.traceId,
      this.spanId,
      spanId,
      beginTimeUnixNs,
      name,
    );
  }

  enter<T>(name: string, f: (span: Span) => T): T {
    const childSpan = this.childSpan(name);
    try {
      const result = f(childSpan);
      childSpan.end();
      return result;
    } finally {
      childSpan.end();
    }
  }

  async enterAsync<T>(name: string, f: (span: Span) => Promise<T>): Promise<T> {
    const childSpan = this.childSpan(name);
    try {
      return await f(childSpan);
    } finally {
      childSpan.end();
    }
  }

  end() {
    const endTimeUnixNs = unixTimeNs();
    const durationNs = endTimeUnixNs - this.beginTimeUnixNs;
    const span = {
      traceId: this.traceId,
      parentId: this.parentId,
      spanId: this.spanId,
      beginTimeUnixNs: serializeNanoseconds(this.beginTimeUnixNs),
      durationNs: serializeNanoseconds(durationNs),
      name: this.name,
      properties: this.properties,
      events: this.events.map((event) => ({
        name: event.name,
        timestampUnixNs: serializeNanoseconds(event.timestampUnixNs),
        properties: event.properties,
      })),
    };
    if (this.reporter) {
      this.reporter.emit(span);
    }
  }

  encodeW3CTraceparent() {
    // Encode traceId and spanId as a big-endian hex strings.
    const traceIdBytes = Buffer.from(this.traceId, "base64url");
    const traceIdBigInt =
      traceIdBytes.readBigUInt64LE(0) |
      (traceIdBytes.readBigUInt64LE(8) << 64n);
    const traceIdHex = traceIdBigInt.toString(16).padStart(32, "0");

    const spanIdBytes = Buffer.from(this.spanId, "base64url");
    const spanIdBigInt = spanIdBytes.readBigUInt64LE(0);
    const spanIdHex = spanIdBigInt.toString(16).padStart(16, "0");

    return `00-${traceIdHex}-${spanIdHex}-01`;
  }
}

function randomTraceId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64url",
  );
}

function emptySpanId() {
  return Buffer.from(new Uint8Array(8)).toString("base64url");
}

function randomSpanId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString(
    "base64url",
  );
}

function unixTimeNs() {
  // Note that as a unix nanosecond timestamp, performance.timeOrigin * 1000 is less than
  // Number.MAX_SAFE_INTEGER, so multiply by 1000 to convert to microseconds, round, convert
  // to bigint, and then multiply again to convert to nanoseconds.
  return (
    BigInt(Math.floor(performance.timeOrigin * 1000)) * 1000n +
    BigInt(Math.floor(performance.now() * 1000)) * 1000n
  );
}

function serializeNanoseconds(ns: Nanoseconds): SerializedNanoseconds {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(ns, 0);
  return buffer.toString("base64url");
}

type CompletedSpan = {
  traceId: TraceId;
  parentId: SpanId;
  spanId: SpanId;
  beginTimeUnixNs: SerializedNanoseconds;
  durationNs: SerializedNanoseconds;
  name: string;
  properties: Record<string, string>;
  events: SerializedEventRecord[];
};

type SerializedEventRecord = {
  name: string;
  timestampUnixNs: SerializedNanoseconds;
  properties: Record<string, string>;
};
