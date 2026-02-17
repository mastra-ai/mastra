/**
 * Minimal hand-rolled protobuf encoder for Prometheus Remote Write.
 *
 * Only implements the subset of the protobuf wire format needed to encode
 * the WriteRequest message type. This avoids a dependency on protobufjs
 * for a very small schema (4 message types, all primitive fields).
 *
 * @see https://protobuf.dev/programming-guides/encoding/
 * @see https://github.com/prometheus/prometheus/blob/main/prompb/types.proto
 */

// Wire types
const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH_DELIMITED = 2;

/**
 * A growable byte buffer for protobuf encoding.
 */
class ProtoWriter {
  private buf: Uint8Array;
  private pos = 0;

  constructor(initialCapacity = 256) {
    this.buf = new Uint8Array(initialCapacity);
  }

  private grow(needed: number): void {
    if (this.pos + needed <= this.buf.length) return;
    let newSize = this.buf.length * 2;
    while (newSize < this.pos + needed) newSize *= 2;
    const newBuf = new Uint8Array(newSize);
    newBuf.set(this.buf);
    this.buf = newBuf;
  }

  /** Write a single byte. */
  writeByte(b: number): void {
    this.grow(1);
    this.buf[this.pos++] = b & 0xff;
  }

  /** Write raw bytes. */
  writeBytes(bytes: Uint8Array): void {
    this.grow(bytes.length);
    this.buf.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  /** Encode a varint (unsigned). */
  writeVarint(value: number | bigint): void {
    let v = typeof value === 'bigint' ? value : BigInt(value);
    if (v < 0n) {
      // Encode negative numbers as 10-byte two's complement
      v = v + (1n << 64n);
    }
    while (v > 0x7fn) {
      this.writeByte(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    this.writeByte(Number(v));
  }

  /** Encode a field tag (field number + wire type). */
  writeTag(fieldNumber: number, wireType: number): void {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  /** Encode a double (IEEE 754, little-endian, 8 bytes). */
  writeDouble(value: number): void {
    this.grow(8);
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
    view.setFloat64(0, value, true); // little-endian
    this.pos += 8;
  }

  /** Encode a UTF-8 string as a length-delimited field. */
  writeString(fieldNumber: number, value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeVarint(encoded.length);
    this.writeBytes(encoded);
  }

  /** Encode a double field (wire type 1). */
  writeDoubleField(fieldNumber: number, value: number): void {
    this.writeTag(fieldNumber, WIRE_64BIT);
    this.writeDouble(value);
  }

  /** Encode an int64 field as a varint. */
  writeInt64Field(fieldNumber: number, value: number | bigint): void {
    this.writeTag(fieldNumber, WIRE_VARINT);
    this.writeVarint(value);
  }

  /** Encode an embedded message field. */
  writeMessage(fieldNumber: number, messageBytes: Uint8Array): void {
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeVarint(messageBytes.length);
    this.writeBytes(messageBytes);
  }

  /** Return the encoded bytes (trimmed to actual size). */
  finish(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

// ============================================================================
// Prometheus Remote Write message types
// ============================================================================

/**
 * A Prometheus label (name-value pair).
 */
export interface PromLabel {
  name: string;
  value: string;
}

/**
 * A Prometheus sample (timestamp + value).
 */
export interface PromSample {
  /** Metric value (IEEE 754 double). */
  value: number;
  /** Timestamp in milliseconds since Unix epoch. */
  timestampMs: number;
}

/**
 * A Prometheus time series (labels + samples).
 */
export interface PromTimeSeries {
  labels: PromLabel[];
  samples: PromSample[];
}

/**
 * A Prometheus WriteRequest (the top-level message).
 */
export interface PromWriteRequest {
  timeseries: PromTimeSeries[];
}

// ============================================================================
// Encoding functions
// ============================================================================

/**
 * Encode a Label message.
 *
 * ```protobuf
 * message Label {
 *   string name  = 1;
 *   string value = 2;
 * }
 * ```
 */
function encodeLabel(label: PromLabel): Uint8Array {
  const w = new ProtoWriter(64);
  w.writeString(1, label.name);
  w.writeString(2, label.value);
  return w.finish();
}

/**
 * Encode a Sample message.
 *
 * ```protobuf
 * message Sample {
 *   double value    = 1;
 *   int64 timestamp = 2;
 * }
 * ```
 */
function encodeSample(sample: PromSample): Uint8Array {
  const w = new ProtoWriter(32);
  w.writeDoubleField(1, sample.value);
  w.writeInt64Field(2, sample.timestampMs);
  return w.finish();
}

/**
 * Encode a TimeSeries message.
 *
 * ```protobuf
 * message TimeSeries {
 *   repeated Label  labels  = 1;
 *   repeated Sample samples = 2;
 * }
 * ```
 */
function encodeTimeSeries(ts: PromTimeSeries): Uint8Array {
  const w = new ProtoWriter(256);
  for (const label of ts.labels) {
    w.writeMessage(1, encodeLabel(label));
  }
  for (const sample of ts.samples) {
    w.writeMessage(2, encodeSample(sample));
  }
  return w.finish();
}

/**
 * Encode a WriteRequest as protobuf binary.
 *
 * ```protobuf
 * message WriteRequest {
 *   repeated TimeSeries timeseries = 1;
 * }
 * ```
 *
 * @param request - The WriteRequest to encode
 * @returns Protobuf-encoded binary data
 */
export function encodeWriteRequest(request: PromWriteRequest): Uint8Array {
  const w = new ProtoWriter(1024);
  for (const ts of request.timeseries) {
    w.writeMessage(1, encodeTimeSeries(ts));
  }
  return w.finish();
}
