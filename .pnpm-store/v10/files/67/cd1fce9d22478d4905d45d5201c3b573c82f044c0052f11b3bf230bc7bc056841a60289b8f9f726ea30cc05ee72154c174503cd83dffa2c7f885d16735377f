"use strict";
import { Base64 } from "../../values/index.js";
import { Long } from "../../vendor/long.js";
export function u64ToLong(encoded) {
  const integerBytes = Base64.toByteArray(encoded);
  return Long.fromBytesLE(Array.from(integerBytes));
}
export function longToU64(raw) {
  const integerBytes = new Uint8Array(raw.toBytesLE());
  return Base64.fromByteArray(integerBytes);
}
export function parseServerMessage(encoded) {
  switch (encoded.type) {
    case "FatalError":
    case "AuthError":
    case "ActionResponse":
    case "TransitionChunk":
    case "Ping": {
      return { ...encoded };
    }
    case "MutationResponse": {
      if (encoded.success) {
        return { ...encoded, ts: u64ToLong(encoded.ts) };
      } else {
        return { ...encoded };
      }
    }
    case "Transition": {
      return {
        ...encoded,
        startVersion: {
          ...encoded.startVersion,
          ts: u64ToLong(encoded.startVersion.ts)
        },
        endVersion: {
          ...encoded.endVersion,
          ts: u64ToLong(encoded.endVersion.ts)
        }
      };
    }
    default: {
      encoded;
    }
  }
  return void 0;
}
export function encodeClientMessage(message) {
  switch (message.type) {
    case "Authenticate":
    case "ModifyQuerySet":
    case "Mutation":
    case "Action":
    case "Event": {
      return { ...message };
    }
    case "Connect": {
      if (message.maxObservedTimestamp !== void 0) {
        return {
          ...message,
          maxObservedTimestamp: longToU64(message.maxObservedTimestamp)
        };
      } else {
        return { ...message, maxObservedTimestamp: void 0 };
      }
    }
    default: {
      message;
    }
  }
  return void 0;
}
//# sourceMappingURL=protocol.js.map
