import { describe, expect, it } from "vitest";
import { createObjectStream } from "./createObjectStream";
import {
  ObjectStreamEncoder,
  ObjectStreamDecoder,
} from "./ObjectStreamResponse";
import { ReadonlyJSONValue } from "../../utils";
import { ObjectStreamChunk } from "./types";

// Helper function to collect all chunks from a stream
async function collectChunks<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const chunks: T[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

// Helper function to encode and decode a stream
async function encodeAndDecode(
  stream: ReadableStream<ObjectStreamChunk>,
): Promise<ReadableStream<ObjectStreamChunk>> {
  // Encode the stream to Uint8Array (simulating network transmission)
  const encodedStream = stream.pipeThrough(new ObjectStreamEncoder());

  // Collect all encoded chunks
  const encodedChunks = await collectChunks(encodedStream);

  // Create a new stream from the encoded chunks
  const reconstructedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of encodedChunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  // Decode the stream back to ObjectStreamChunk
  return reconstructedStream.pipeThrough(new ObjectStreamDecoder());
}

describe("ObjectStream serialization and deserialization", () => {
  it("should correctly serialize and deserialize simple objects", async () => {
    // Create an object stream with simple operations
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["name"], value: "John" },
          { type: "set", path: ["age"], value: 30 },
        ]);
      },
    });

    // Encode and decode the stream
    const decodedStream = await encodeAndDecode(stream);

    // Collect all chunks from the decoded stream
    const chunks = await collectChunks(decodedStream);

    // Verify the final state
    const finalChunk = chunks[chunks.length - 1]!;
    expect(finalChunk.snapshot).toEqual({
      name: "John",
      age: 30,
    });
  });

  it("should correctly handle nested objects", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["user", "profile", "name"], value: "Jane" },
          {
            type: "set",
            path: ["user", "profile", "email"],
            value: "jane@example.com",
          },
          { type: "set", path: ["user", "settings", "theme"], value: "dark" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      user: {
        profile: {
          name: "Jane",
          email: "jane@example.com",
        },
        settings: {
          theme: "dark",
        },
      },
    });
  });

  it("should correctly handle arrays", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["items"], value: [] },
          { type: "set", path: ["items", "0"], value: "apple" },
          { type: "set", path: ["items", "1"], value: "banana" },
          { type: "set", path: ["items", "2"], value: "cherry" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      items: ["apple", "banana", "cherry"],
    });
  });

  it("should correctly handle mixed arrays and objects", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["users"], value: [] },
          { type: "set", path: ["users", "0"], value: {} },
          { type: "set", path: ["users", "0", "id"], value: 1 },
          { type: "set", path: ["users", "0", "name"], value: "Alice" },
          { type: "set", path: ["users", "1"], value: {} },
          { type: "set", path: ["users", "1", "id"], value: 2 },
          { type: "set", path: ["users", "1", "name"], value: "Bob" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });
  });

  it("should correctly handle append-text operations", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["message"], value: "Hello" },
          { type: "append-text", path: ["message"], value: " " },
          { type: "append-text", path: ["message"], value: "World" },
          { type: "append-text", path: ["message"], value: "!" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      message: "Hello World!",
    });
  });

  it("should correctly handle special characters and Unicode", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          {
            type: "set",
            path: ["special"],
            value: "Special chars: !@#$%^&*()",
          },
          { type: "set", path: ["unicode"], value: "Unicode: 😀🌍🚀" },
          { type: "set", path: ["quotes"], value: "Quotes: \"'`" },
          {
            type: "set",
            path: ["newlines"],
            value: "Line 1\nLine 2\r\nLine 3",
          },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      special: "Special chars: !@#$%^&*()",
      unicode: "Unicode: 😀🌍🚀",
      quotes: "Quotes: \"'`",
      newlines: "Line 1\nLine 2\r\nLine 3",
    });
  });

  it("should correctly handle null and undefined values", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["nullValue"], value: null },
          { type: "set", path: ["emptyObject"], value: {} },
          { type: "set", path: ["emptyArray"], value: [] },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      nullValue: null,
      emptyObject: {},
      emptyArray: [],
    });
  });

  it("should correctly handle large nested structures", async () => {
    // Create a deep nested structure
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["level1"], value: {} },
          { type: "set", path: ["level1", "level2"], value: {} },
          { type: "set", path: ["level1", "level2", "level3"], value: {} },
          {
            type: "set",
            path: ["level1", "level2", "level3", "level4"],
            value: {},
          },
          {
            type: "set",
            path: ["level1", "level2", "level3", "level4", "level5"],
            value: "deep value",
          },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: "deep value",
            },
          },
        },
      },
    });
  });

  it("should correctly handle operations in multiple enqueue calls", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        // First batch of operations
        controller.enqueue([
          { type: "set", path: ["user"], value: { name: "Initial" } },
        ]);

        // Second batch of operations
        controller.enqueue([
          { type: "set", path: ["user", "name"], value: "Updated" },
          { type: "set", path: ["user", "email"], value: "user@example.com" },
        ]);

        // Third batch of operations
        controller.enqueue([
          { type: "set", path: ["status"], value: "complete" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      user: {
        name: "Updated",
        email: "user@example.com",
      },
      status: "complete",
    });

    // Verify that we got the correct number of chunks
    expect(chunks.length).toBe(3);

    // Verify intermediate states
    expect(chunks[0]!.snapshot).toEqual({
      user: { name: "Initial" },
    });

    expect(chunks[1]!.snapshot).toEqual({
      user: {
        name: "Updated",
        email: "user@example.com",
      },
    });
  });

  it("should correctly handle overwriting existing values", async () => {
    const stream = createObjectStream({
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["value"], value: "initial" },
          { type: "set", path: ["nested"], value: { prop: "initial" } },
        ]);

        controller.enqueue([
          { type: "set", path: ["value"], value: "updated" },
          { type: "set", path: ["nested"], value: "completely replaced" },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      value: "updated",
      nested: "completely replaced",
    });
  });

  it("should correctly handle custom initial values", async () => {
    const initialValue: ReadonlyJSONValue = {
      existing: "value",
      nested: {
        prop: 123,
      },
    };

    const stream = createObjectStream({
      defaultValue: initialValue,
      execute: (controller) => {
        controller.enqueue([
          { type: "set", path: ["new"], value: "added" },
          { type: "set", path: ["nested", "prop"], value: 456 },
        ]);
      },
    });

    const decodedStream = await encodeAndDecode(stream);
    const chunks = await collectChunks(decodedStream);
    const finalChunk = chunks[chunks.length - 1]!;

    expect(finalChunk.snapshot).toEqual({
      existing: "value",
      nested: {
        prop: 456,
      },
      new: "added",
    });
  });
});
