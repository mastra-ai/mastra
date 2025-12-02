"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import crypto from "node:crypto";
export class Reporter {
  constructor() {
    __publicField(this, "spans", []);
  }
  emit(span) {
    this.spans.push(span);
  }
}
export class Span {
  constructor(reporter, traceId, parentId, spanId, beginTimeUnixNs, name) {
    this.reporter = reporter;
    this.traceId = traceId;
    this.parentId = parentId;
    this.spanId = spanId;
    this.beginTimeUnixNs = beginTimeUnixNs;
    this.name = name;
    __publicField(this, "properties", {});
    __publicField(this, "events", []);
  }
  static noop() {
    return new Span(
      void 0,
      randomTraceId(),
      randomSpanId(),
      randomSpanId(),
      unixTimeNs(),
      ""
    );
  }
  static root(reporter, name) {
    const traceId = randomTraceId();
    const parentId = emptySpanId();
    const spanId = randomSpanId();
    const beginTimeUnixNs = unixTimeNs();
    return new Span(reporter, traceId, parentId, spanId, beginTimeUnixNs, name);
  }
  setProperty(key, value) {
    this.properties[key] = value;
  }
  childSpan(name) {
    const spanId = randomSpanId();
    const beginTimeUnixNs = unixTimeNs();
    return new Span(
      this.reporter,
      this.traceId,
      this.spanId,
      spanId,
      beginTimeUnixNs,
      name
    );
  }
  enter(name, f) {
    const childSpan = this.childSpan(name);
    try {
      const result = f(childSpan);
      childSpan.end();
      return result;
    } finally {
      childSpan.end();
    }
  }
  async enterAsync(name, f) {
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
        properties: event.properties
      }))
    };
    if (this.reporter) {
      this.reporter.emit(span);
    }
  }
  encodeW3CTraceparent() {
    const traceIdBytes = Buffer.from(this.traceId, "base64url");
    const traceIdBigInt = traceIdBytes.readBigUInt64LE(0) | traceIdBytes.readBigUInt64LE(8) << 64n;
    const traceIdHex = traceIdBigInt.toString(16).padStart(32, "0");
    const spanIdBytes = Buffer.from(this.spanId, "base64url");
    const spanIdBigInt = spanIdBytes.readBigUInt64LE(0);
    const spanIdHex = spanIdBigInt.toString(16).padStart(16, "0");
    return `00-${traceIdHex}-${spanIdHex}-01`;
  }
}
function randomTraceId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64url"
  );
}
function emptySpanId() {
  return Buffer.from(new Uint8Array(8)).toString("base64url");
}
function randomSpanId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString(
    "base64url"
  );
}
function unixTimeNs() {
  return BigInt(Math.floor(performance.timeOrigin * 1e3)) * 1000n + BigInt(Math.floor(performance.now() * 1e3)) * 1000n;
}
function serializeNanoseconds(ns) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(ns, 0);
  return buffer.toString("base64url");
}
//# sourceMappingURL=tracing.js.map
