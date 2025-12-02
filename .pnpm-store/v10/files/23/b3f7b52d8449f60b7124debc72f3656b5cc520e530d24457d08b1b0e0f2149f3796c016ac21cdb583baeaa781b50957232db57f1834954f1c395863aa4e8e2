/**
 * @file Adapted from [posthog-js](https://github.com/PostHog/posthog-js/blob/8157df935a4d0e71d2fefef7127aa85ee51c82d1/src/extensions/sentry-integration.ts) with modifications for the Node SDK.
 */
/**
 * Integrate Sentry with PostHog. This will add a direct link to the person in Sentry, and an $exception event in PostHog.
 *
 * ### Usage
 *
 *     Sentry.init({
 *          dsn: 'https://example',
 *          integrations: [
 *              new PostHogSentryIntegration(posthog)
 *          ]
 *     })
 *
 *     Sentry.setTag(PostHogSentryIntegration.POSTHOG_ID_TAG, 'some distinct id');
 *
 * @param {Object} [posthog] The posthog object
 * @param {string} [organization] Optional: The Sentry organization, used to send a direct link from PostHog to Sentry
 * @param {Number} [projectId] Optional: The Sentry project id, used to send a direct link from PostHog to Sentry
 * @param {string} [prefix] Optional: Url of a self-hosted sentry instance (default: https://sentry.io/organizations/)
 * @param {SeverityLevel[] | '*'} [severityAllowList] Optional: send events matching the provided levels. Use '*' to send all events (default: ['error'])
 */
const NAME = 'posthog-node';
function createEventProcessor(_posthog, {
  organization,
  projectId,
  prefix,
  severityAllowList = ['error']
} = {}) {
  return event => {
    const shouldProcessLevel = severityAllowList === '*' || severityAllowList.includes(event.level);
    if (!shouldProcessLevel) {
      return event;
    }
    if (!event.tags) {
      event.tags = {};
    }
    // Get the PostHog user ID from a specific tag, which users can set on their Sentry scope as they need.
    const userId = event.tags[PostHogSentryIntegration.POSTHOG_ID_TAG];
    if (userId === undefined) {
      // If we can't find a user ID, don't bother linking the event. We won't be able to send anything meaningful to PostHog without it.
      return event;
    }
    const uiHost = _posthog.options.host ?? 'https://us.i.posthog.com';
    const personUrl = new URL(`/project/${_posthog.apiKey}/person/${userId}`, uiHost).toString();
    event.tags['PostHog Person URL'] = personUrl;
    const exceptions = event.exception?.values || [];
    const exceptionList = exceptions.map(exception => ({
      ...exception,
      stacktrace: exception.stacktrace ? {
        ...exception.stacktrace,
        type: 'raw',
        frames: (exception.stacktrace.frames || []).map(frame => {
          return {
            ...frame,
            platform: 'node:javascript'
          };
        })
      } : undefined
    }));
    const properties = {
      // PostHog Exception Properties,
      $exception_message: exceptions[0]?.value || event.message,
      $exception_type: exceptions[0]?.type,
      $exception_personURL: personUrl,
      $exception_level: event.level,
      $exception_list: exceptionList,
      // Sentry Exception Properties
      $sentry_event_id: event.event_id,
      $sentry_exception: event.exception,
      $sentry_exception_message: exceptions[0]?.value || event.message,
      $sentry_exception_type: exceptions[0]?.type,
      $sentry_tags: event.tags
    };
    if (organization && projectId) {
      properties['$sentry_url'] = (prefix || 'https://sentry.io/organizations/') + organization + '/issues/?project=' + projectId + '&query=' + event.event_id;
    }
    _posthog.capture({
      event: '$exception',
      distinctId: userId,
      properties
    });
    return event;
  };
}
// V8 integration - function based
function sentryIntegration(_posthog, options) {
  const processor = createEventProcessor(_posthog, options);
  return {
    name: NAME,
    processEvent(event) {
      return processor(event);
    }
  };
}
// V7 integration - class based
class PostHogSentryIntegration {
  constructor(_posthog, organization, prefix, severityAllowList) {
    this.name = NAME;
    // setupOnce gets called by Sentry when it intializes the plugin
    this.name = NAME;
    this.setupOnce = function (addGlobalEventProcessor, getCurrentHub) {
      const projectId = getCurrentHub()?.getClient()?.getDsn()?.projectId;
      addGlobalEventProcessor(createEventProcessor(_posthog, {
        organization,
        projectId,
        prefix,
        severityAllowList
      }));
    };
  }
}
PostHogSentryIntegration.POSTHOG_ID_TAG = 'posthog_distinct_id';

// vendor from: https://github.com/LiosK/uuidv7/blob/f30b7a7faff73afbce0b27a46c638310f96912ba/src/index.ts
// https://github.com/LiosK/uuidv7#license
/**
 * uuidv7: An experimental implementation of the proposed UUID Version 7
 *
 * @license Apache-2.0
 * @copyright 2021-2023 LiosK
 * @packageDocumentation
 */
const DIGITS = "0123456789abcdef";
/** Represents a UUID as a 16-byte byte array. */
class UUID {
    /** @param bytes - The 16-byte byte array representation. */
    constructor(bytes) {
        this.bytes = bytes;
    }
    /**
     * Creates an object from the internal representation, a 16-byte byte array
     * containing the binary UUID representation in the big-endian byte order.
     *
     * This method does NOT shallow-copy the argument, and thus the created object
     * holds the reference to the underlying buffer.
     *
     * @throws TypeError if the length of the argument is not 16.
     */
    static ofInner(bytes) {
        if (bytes.length !== 16) {
            throw new TypeError("not 128-bit length");
        }
        else {
            return new UUID(bytes);
        }
    }
    /**
     * Builds a byte array from UUIDv7 field values.
     *
     * @param unixTsMs - A 48-bit `unix_ts_ms` field value.
     * @param randA - A 12-bit `rand_a` field value.
     * @param randBHi - The higher 30 bits of 62-bit `rand_b` field value.
     * @param randBLo - The lower 32 bits of 62-bit `rand_b` field value.
     * @throws RangeError if any field value is out of the specified range.
     */
    static fromFieldsV7(unixTsMs, randA, randBHi, randBLo) {
        if (!Number.isInteger(unixTsMs) ||
            !Number.isInteger(randA) ||
            !Number.isInteger(randBHi) ||
            !Number.isInteger(randBLo) ||
            unixTsMs < 0 ||
            randA < 0 ||
            randBHi < 0 ||
            randBLo < 0 ||
            unixTsMs > 281474976710655 ||
            randA > 0xfff ||
            randBHi > 1073741823 ||
            randBLo > 4294967295) {
            throw new RangeError("invalid field value");
        }
        const bytes = new Uint8Array(16);
        bytes[0] = unixTsMs / 2 ** 40;
        bytes[1] = unixTsMs / 2 ** 32;
        bytes[2] = unixTsMs / 2 ** 24;
        bytes[3] = unixTsMs / 2 ** 16;
        bytes[4] = unixTsMs / 2 ** 8;
        bytes[5] = unixTsMs;
        bytes[6] = 0x70 | (randA >>> 8);
        bytes[7] = randA;
        bytes[8] = 0x80 | (randBHi >>> 24);
        bytes[9] = randBHi >>> 16;
        bytes[10] = randBHi >>> 8;
        bytes[11] = randBHi;
        bytes[12] = randBLo >>> 24;
        bytes[13] = randBLo >>> 16;
        bytes[14] = randBLo >>> 8;
        bytes[15] = randBLo;
        return new UUID(bytes);
    }
    /**
     * Builds a byte array from a string representation.
     *
     * This method accepts the following formats:
     *
     * - 32-digit hexadecimal format without hyphens: `0189dcd553117d408db09496a2eef37b`
     * - 8-4-4-4-12 hyphenated format: `0189dcd5-5311-7d40-8db0-9496a2eef37b`
     * - Hyphenated format with surrounding braces: `{0189dcd5-5311-7d40-8db0-9496a2eef37b}`
     * - RFC 4122 URN format: `urn:uuid:0189dcd5-5311-7d40-8db0-9496a2eef37b`
     *
     * Leading and trailing whitespaces represents an error.
     *
     * @throws SyntaxError if the argument could not parse as a valid UUID string.
     */
    static parse(uuid) {
        let hex = undefined;
        switch (uuid.length) {
            case 32:
                hex = /^[0-9a-f]{32}$/i.exec(uuid)?.[0];
                break;
            case 36:
                hex =
                    /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
            case 38:
                hex =
                    /^\{([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
            case 45:
                hex =
                    /^urn:uuid:([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i
                        .exec(uuid)
                        ?.slice(1, 6)
                        .join("");
                break;
        }
        if (hex) {
            const inner = new Uint8Array(16);
            for (let i = 0; i < 16; i += 4) {
                const n = parseInt(hex.substring(2 * i, 2 * i + 8), 16);
                inner[i + 0] = n >>> 24;
                inner[i + 1] = n >>> 16;
                inner[i + 2] = n >>> 8;
                inner[i + 3] = n;
            }
            return new UUID(inner);
        }
        else {
            throw new SyntaxError("could not parse UUID string");
        }
    }
    /**
     * @returns The 8-4-4-4-12 canonical hexadecimal string representation
     * (`0189dcd5-5311-7d40-8db0-9496a2eef37b`).
     */
    toString() {
        let text = "";
        for (let i = 0; i < this.bytes.length; i++) {
            text += DIGITS.charAt(this.bytes[i] >>> 4);
            text += DIGITS.charAt(this.bytes[i] & 0xf);
            if (i === 3 || i === 5 || i === 7 || i === 9) {
                text += "-";
            }
        }
        return text;
    }
    /**
     * @returns The 32-digit hexadecimal representation without hyphens
     * (`0189dcd553117d408db09496a2eef37b`).
     */
    toHex() {
        let text = "";
        for (let i = 0; i < this.bytes.length; i++) {
            text += DIGITS.charAt(this.bytes[i] >>> 4);
            text += DIGITS.charAt(this.bytes[i] & 0xf);
        }
        return text;
    }
    /** @returns The 8-4-4-4-12 canonical hexadecimal string representation. */
    toJSON() {
        return this.toString();
    }
    /**
     * Reports the variant field value of the UUID or, if appropriate, "NIL" or
     * "MAX".
     *
     * For convenience, this method reports "NIL" or "MAX" if `this` represents
     * the Nil or Max UUID, although the Nil and Max UUIDs are technically
     * subsumed under the variants `0b0` and `0b111`, respectively.
     */
    getVariant() {
        const n = this.bytes[8] >>> 4;
        if (n < 0) {
            throw new Error("unreachable");
        }
        else if (n <= 0b0111) {
            return this.bytes.every((e) => e === 0) ? "NIL" : "VAR_0";
        }
        else if (n <= 0b1011) {
            return "VAR_10";
        }
        else if (n <= 0b1101) {
            return "VAR_110";
        }
        else if (n <= 0b1111) {
            return this.bytes.every((e) => e === 0xff) ? "MAX" : "VAR_RESERVED";
        }
        else {
            throw new Error("unreachable");
        }
    }
    /**
     * Returns the version field value of the UUID or `undefined` if the UUID does
     * not have the variant field value of `0b10`.
     */
    getVersion() {
        return this.getVariant() === "VAR_10" ? this.bytes[6] >>> 4 : undefined;
    }
    /** Creates an object from `this`. */
    clone() {
        return new UUID(this.bytes.slice(0));
    }
    /** Returns true if `this` is equivalent to `other`. */
    equals(other) {
        return this.compareTo(other) === 0;
    }
    /**
     * Returns a negative integer, zero, or positive integer if `this` is less
     * than, equal to, or greater than `other`, respectively.
     */
    compareTo(other) {
        for (let i = 0; i < 16; i++) {
            const diff = this.bytes[i] - other.bytes[i];
            if (diff !== 0) {
                return Math.sign(diff);
            }
        }
        return 0;
    }
}
/**
 * Encapsulates the monotonic counter state.
 *
 * This class provides APIs to utilize a separate counter state from that of the
 * global generator used by {@link uuidv7} and {@link uuidv7obj}. In addition to
 * the default {@link generate} method, this class has {@link generateOrAbort}
 * that is useful to absolutely guarantee the monotonically increasing order of
 * generated UUIDs. See their respective documentation for details.
 */
class V7Generator {
    /**
     * Creates a generator object with the default random number generator, or
     * with the specified one if passed as an argument. The specified random
     * number generator should be cryptographically strong and securely seeded.
     */
    constructor(randomNumberGenerator) {
        this.timestamp = 0;
        this.counter = 0;
        this.random = randomNumberGenerator ?? getDefaultRandom();
    }
    /**
     * Generates a new UUIDv7 object from the current timestamp, or resets the
     * generator upon significant timestamp rollback.
     *
     * This method returns a monotonically increasing UUID by reusing the previous
     * timestamp even if the up-to-date timestamp is smaller than the immediately
     * preceding UUID's. However, when such a clock rollback is considered
     * significant (i.e., by more than ten seconds), this method resets the
     * generator and returns a new UUID based on the given timestamp, breaking the
     * increasing order of UUIDs.
     *
     * See {@link generateOrAbort} for the other mode of generation and
     * {@link generateOrResetCore} for the low-level primitive.
     */
    generate() {
        return this.generateOrResetCore(Date.now(), 10000);
    }
    /**
     * Generates a new UUIDv7 object from the current timestamp, or returns
     * `undefined` upon significant timestamp rollback.
     *
     * This method returns a monotonically increasing UUID by reusing the previous
     * timestamp even if the up-to-date timestamp is smaller than the immediately
     * preceding UUID's. However, when such a clock rollback is considered
     * significant (i.e., by more than ten seconds), this method aborts and
     * returns `undefined` immediately.
     *
     * See {@link generate} for the other mode of generation and
     * {@link generateOrAbortCore} for the low-level primitive.
     */
    generateOrAbort() {
        return this.generateOrAbortCore(Date.now(), 10000);
    }
    /**
     * Generates a new UUIDv7 object from the `unixTsMs` passed, or resets the
     * generator upon significant timestamp rollback.
     *
     * This method is equivalent to {@link generate} except that it takes a custom
     * timestamp and clock rollback allowance.
     *
     * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
     * considered significant. A suggested value is `10_000` (milliseconds).
     * @throws RangeError if `unixTsMs` is not a 48-bit positive integer.
     */
    generateOrResetCore(unixTsMs, rollbackAllowance) {
        let value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
        if (value === undefined) {
            // reset state and resume
            this.timestamp = 0;
            value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
        }
        return value;
    }
    /**
     * Generates a new UUIDv7 object from the `unixTsMs` passed, or returns
     * `undefined` upon significant timestamp rollback.
     *
     * This method is equivalent to {@link generateOrAbort} except that it takes a
     * custom timestamp and clock rollback allowance.
     *
     * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
     * considered significant. A suggested value is `10_000` (milliseconds).
     * @throws RangeError if `unixTsMs` is not a 48-bit positive integer.
     */
    generateOrAbortCore(unixTsMs, rollbackAllowance) {
        const MAX_COUNTER = 4398046511103;
        if (!Number.isInteger(unixTsMs) ||
            unixTsMs < 1 ||
            unixTsMs > 281474976710655) {
            throw new RangeError("`unixTsMs` must be a 48-bit positive integer");
        }
        else if (rollbackAllowance < 0 || rollbackAllowance > 281474976710655) {
            throw new RangeError("`rollbackAllowance` out of reasonable range");
        }
        if (unixTsMs > this.timestamp) {
            this.timestamp = unixTsMs;
            this.resetCounter();
        }
        else if (unixTsMs + rollbackAllowance >= this.timestamp) {
            // go on with previous timestamp if new one is not much smaller
            this.counter++;
            if (this.counter > MAX_COUNTER) {
                // increment timestamp at counter overflow
                this.timestamp++;
                this.resetCounter();
            }
        }
        else {
            // abort if clock went backwards to unbearable extent
            return undefined;
        }
        return UUID.fromFieldsV7(this.timestamp, Math.trunc(this.counter / 2 ** 30), this.counter & (2 ** 30 - 1), this.random.nextUint32());
    }
    /** Initializes the counter at a 42-bit random integer. */
    resetCounter() {
        this.counter =
            this.random.nextUint32() * 0x400 + (this.random.nextUint32() & 0x3ff);
    }
    /**
     * Generates a new UUIDv4 object utilizing the random number generator inside.
     *
     * @internal
     */
    generateV4() {
        const bytes = new Uint8Array(Uint32Array.of(this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32()).buffer);
        bytes[6] = 0x40 | (bytes[6] >>> 4);
        bytes[8] = 0x80 | (bytes[8] >>> 2);
        return UUID.ofInner(bytes);
    }
}
/** A global flag to force use of cryptographically strong RNG. */
// declare const UUIDV7_DENY_WEAK_RNG: boolean;
/** Returns the default random number generator available in the environment. */
const getDefaultRandom = () => {
    // fix: crypto isn't available in react-native, always use Math.random
    //   // detect Web Crypto API
    //   if (
    //     typeof crypto !== "undefined" &&
    //     typeof crypto.getRandomValues !== "undefined"
    //   ) {
    //     return new BufferedCryptoRandom();
    //   } else {
    //     // fall back on Math.random() unless the flag is set to true
    //     if (typeof UUIDV7_DENY_WEAK_RNG !== "undefined" && UUIDV7_DENY_WEAK_RNG) {
    //       throw new Error("no cryptographically strong RNG available");
    //     }
    //     return {
    //       nextUint32: (): number =>
    //         Math.trunc(Math.random() * 0x1_0000) * 0x1_0000 +
    //         Math.trunc(Math.random() * 0x1_0000),
    //     };
    //   }
    return {
        nextUint32: () => Math.trunc(Math.random() * 65536) * 65536 +
            Math.trunc(Math.random() * 65536),
    };
};
// /**
//  * Wraps `crypto.getRandomValues()` to enable buffering; this uses a small
//  * buffer by default to avoid both unbearable throughput decline in some
//  * environments and the waste of time and space for unused values.
//  */
// class BufferedCryptoRandom {
//   private readonly buffer = new Uint32Array(8);
//   private cursor = 0xffff;
//   nextUint32(): number {
//     if (this.cursor >= this.buffer.length) {
//       crypto.getRandomValues(this.buffer);
//       this.cursor = 0;
//     }
//     return this.buffer[this.cursor++];
//   }
// }
let defaultGenerator;
/**
 * Generates a UUIDv7 string.
 *
 * @returns The 8-4-4-4-12 canonical hexadecimal string representation
 * ("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
 */
const uuidv7 = () => uuidv7obj().toString();
/** Generates a UUIDv7 object. */
const uuidv7obj = () => (defaultGenerator || (defaultGenerator = new V7Generator())).generate();

// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License
function makeUncaughtExceptionHandler(captureFn, onFatalFn) {
  let calledFatalError = false;
  return Object.assign(error => {
    // Attaching a listener to `uncaughtException` will prevent the node process from exiting. We generally do not
    // want to alter this behaviour so we check for other listeners that users may have attached themselves and adjust
    // exit behaviour of the SDK accordingly:
    // - If other listeners are attached, do not exit.
    // - If the only listener attached is ours, exit.
    const userProvidedListenersCount = global.process.listeners('uncaughtException').filter(listener => {
      // There are 2 listeners we ignore:
      return (
        // as soon as we're using domains this listener is attached by node itself
        listener.name !== 'domainUncaughtExceptionClear' &&
        // the handler we register in this integration
        listener._posthogErrorHandler !== true
      );
    }).length;
    const processWouldExit = userProvidedListenersCount === 0;
    captureFn(error, {
      mechanism: {
        type: 'onuncaughtexception',
        handled: false
      }
    });
    if (!calledFatalError && processWouldExit) {
      calledFatalError = true;
      onFatalFn();
    }
  }, {
    _posthogErrorHandler: true
  });
}
function addUncaughtExceptionListener(captureFn, onFatalFn) {
  global.process.on('uncaughtException', makeUncaughtExceptionHandler(captureFn, onFatalFn));
}
function addUnhandledRejectionListener(captureFn) {
  global.process.on('unhandledRejection', reason => {
    captureFn(reason, {
      mechanism: {
        type: 'onunhandledrejection',
        handled: false
      }
    });
  });
}

// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License
let parsedStackResults;
let lastKeysCount;
let cachedFilenameChunkIds;
function getFilenameToChunkIdMap(stackParser) {
  const chunkIdMap = globalThis._posthogChunkIds;
  if (!chunkIdMap) {
    console.error('No chunk id map found');
    return {};
  }
  const chunkIdKeys = Object.keys(chunkIdMap);
  if (cachedFilenameChunkIds && chunkIdKeys.length === lastKeysCount) {
    return cachedFilenameChunkIds;
  }
  lastKeysCount = chunkIdKeys.length;
  cachedFilenameChunkIds = chunkIdKeys.reduce((acc, stackKey) => {
    if (!parsedStackResults) {
      parsedStackResults = {};
    }
    const result = parsedStackResults[stackKey];
    if (result) {
      acc[result[0]] = result[1];
    } else {
      const parsedStack = stackParser(stackKey);
      for (let i = parsedStack.length - 1; i >= 0; i--) {
        const stackFrame = parsedStack[i];
        const filename = stackFrame?.filename;
        const chunkId = chunkIdMap[stackKey];
        if (filename && chunkId) {
          acc[filename] = chunkId;
          parsedStackResults[stackKey] = [filename, chunkId];
          break;
        }
      }
    }
    return acc;
  }, {});
  return cachedFilenameChunkIds;
}

// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License
function isEvent(candidate) {
  return typeof Event !== 'undefined' && isInstanceOf(candidate, Event);
}
function isPlainObject(candidate) {
  return isBuiltin(candidate, 'Object');
}
function isError(candidate) {
  switch (Object.prototype.toString.call(candidate)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
    case '[object WebAssembly.Exception]':
      return true;
    default:
      return isInstanceOf(candidate, Error);
  }
}
function isInstanceOf(candidate, base) {
  try {
    return candidate instanceof base;
  } catch {
    return false;
  }
}
function isErrorEvent(event) {
  return isBuiltin(event, 'ErrorEvent');
}
function isBuiltin(candidate, className) {
  return Object.prototype.toString.call(candidate) === `[object ${className}]`;
}

// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
async function propertiesFromUnknownInput(stackParser, frameModifiers, input, hint) {
  const providedMechanism = hint && hint.mechanism;
  const mechanism = providedMechanism || {
    handled: true,
    type: 'generic'
  };
  const errorList = getErrorList(mechanism, input, hint);
  const exceptionList = await Promise.all(errorList.map(async error => {
    const exception = await exceptionFromError(stackParser, frameModifiers, error);
    exception.value = exception.value || '';
    exception.type = exception.type || 'Error';
    exception.mechanism = mechanism;
    return exception;
  }));
  const properties = {
    $exception_list: exceptionList
  };
  return properties;
}
// Flatten error causes into a list of errors
// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
function getErrorList(mechanism, input, hint) {
  const error = getError(mechanism, input, hint);
  if (error.cause) {
    return [error, ...getErrorList(mechanism, error.cause, hint)];
  }
  return [error];
}
function getError(mechanism, exception, hint) {
  if (isError(exception)) {
    return exception;
  }
  mechanism.synthetic = true;
  if (isPlainObject(exception)) {
    const errorFromProp = getErrorPropertyFromObject(exception);
    if (errorFromProp) {
      return errorFromProp;
    }
    const message = getMessageForObject(exception);
    const ex = hint?.syntheticException || new Error(message);
    ex.message = message;
    return ex;
  }
  // This handles when someone does: `throw "something awesome";`
  // We use synthesized Error here so we can extract a (rough) stack trace.
  const ex = hint?.syntheticException || new Error(exception);
  ex.message = `${exception}`;
  return ex;
}
/** If a plain object has a property that is an `Error`, return this error. */
function getErrorPropertyFromObject(obj) {
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      const value = obj[prop];
      if (isError(value)) {
        return value;
      }
    }
  }
  return undefined;
}
function getMessageForObject(exception) {
  if ('name' in exception && typeof exception.name === 'string') {
    let message = `'${exception.name}' captured as exception`;
    if ('message' in exception && typeof exception.message === 'string') {
      message += ` with message '${exception.message}'`;
    }
    return message;
  } else if ('message' in exception && typeof exception.message === 'string') {
    return exception.message;
  }
  const keys = extractExceptionKeysForMessage(exception);
  // Some ErrorEvent instances do not have an `error` property, which is why they are not handled before
  // We still want to try to get a decent message for these cases
  if (isErrorEvent(exception)) {
    return `Event \`ErrorEvent\` captured as exception with message \`${exception.message}\``;
  }
  const className = getObjectClassName(exception);
  return `${className && className !== 'Object' ? `'${className}'` : 'Object'} captured as exception with keys: ${keys}`;
}
function getObjectClassName(obj) {
  try {
    const prototype = Object.getPrototypeOf(obj);
    return prototype ? prototype.constructor.name : undefined;
  } catch (e) {
    // ignore errors here
  }
}
/**
 * Given any captured exception, extract its keys and create a sorted
 * and truncated list that will be used inside the event message.
 * eg. `Non-error exception captured with keys: foo, bar, baz`
 */
function extractExceptionKeysForMessage(exception, maxLength = 40) {
  const keys = Object.keys(convertToPlainObject(exception));
  keys.sort();
  const firstKey = keys[0];
  if (!firstKey) {
    return '[object has no keys]';
  }
  if (firstKey.length >= maxLength) {
    return truncate(firstKey, maxLength);
  }
  for (let includedKeys = keys.length; includedKeys > 0; includedKeys--) {
    const serialized = keys.slice(0, includedKeys).join(', ');
    if (serialized.length > maxLength) {
      continue;
    }
    if (includedKeys === keys.length) {
      return serialized;
    }
    return truncate(serialized, maxLength);
  }
  return '';
}
function truncate(str, max = 0) {
  if (typeof str !== 'string' || max === 0) {
    return str;
  }
  return str.length <= max ? str : `${str.slice(0, max)}...`;
}
/**
 * Transforms any `Error` or `Event` into a plain object with all of their enumerable properties, and some of their
 * non-enumerable properties attached.
 *
 * @param value Initial source that we have to transform in order for it to be usable by the serializer
 * @returns An Event or Error turned into an object - or the value argument itself, when value is neither an Event nor
 *  an Error.
 */
function convertToPlainObject(value) {
  if (isError(value)) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
      ...getOwnProperties(value)
    };
  } else if (isEvent(value)) {
    const newObj = {
      type: value.type,
      target: serializeEventTarget(value.target),
      currentTarget: serializeEventTarget(value.currentTarget),
      ...getOwnProperties(value)
    };
    // TODO: figure out why this fails typing (I think CustomEvent is only supported in Node 19 onwards)
    // if (typeof CustomEvent !== 'undefined' && isInstanceOf(value, CustomEvent)) {
    //   newObj.detail = (value as unknown as CustomEvent).detail
    // }
    return newObj;
  } else {
    return value;
  }
}
/** Filters out all but an object's own properties */
function getOwnProperties(obj) {
  if (typeof obj === 'object' && obj !== null) {
    const extractedProps = {};
    for (const property in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, property)) {
        extractedProps[property] = obj[property];
      }
    }
    return extractedProps;
  } else {
    return {};
  }
}
/** Creates a string representation of the target of an `Event` object */
function serializeEventTarget(target) {
  try {
    return Object.prototype.toString.call(target);
  } catch (_oO) {
    return '<unknown>';
  }
}
/**
 * Extracts stack frames from the error and builds an Exception
 */
async function exceptionFromError(stackParser, frameModifiers, error) {
  const exception = {
    type: error.name || error.constructor.name,
    value: error.message
  };
  let frames = parseStackFrames(stackParser, error);
  for (const modifier of frameModifiers) {
    frames = await modifier(frames);
  }
  if (frames.length) {
    exception.stacktrace = {
      frames,
      type: 'raw'
    };
  }
  return exception;
}
/**
 * Extracts stack frames from the error.stack string
 */
function parseStackFrames(stackParser, error) {
  return applyChunkIds(stackParser(error.stack || '', 1), stackParser);
}
function applyChunkIds(frames, parser) {
  const filenameChunkIdMap = getFilenameToChunkIdMap(parser);
  frames.forEach(frame => {
    if (frame.filename) {
      frame.chunk_id = filenameChunkIdMap[frame.filename];
    }
  });
  return frames;
}

const SHUTDOWN_TIMEOUT = 2000;
class ErrorTracking {
  static async captureException(client, error, hint, distinctId, additionalProperties) {
    const properties = {
      ...additionalProperties
    };
    // Given stateless nature of Node SDK we capture exceptions using personless processing when no
    // user can be determined because a distinct_id is not provided e.g. exception autocapture
    if (!distinctId) {
      properties.$process_person_profile = false;
    }
    const exceptionProperties = await propertiesFromUnknownInput(this.stackParser, this.frameModifiers, error, hint);
    client.capture({
      event: '$exception',
      distinctId: distinctId || uuidv7(),
      properties: {
        ...exceptionProperties,
        ...properties
      }
    });
  }
  constructor(client, options) {
    this.client = client;
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false;
    this.startAutocaptureIfEnabled();
  }
  startAutocaptureIfEnabled() {
    if (this.isEnabled()) {
      addUncaughtExceptionListener(this.onException.bind(this), this.onFatalError.bind(this));
      addUnhandledRejectionListener(this.onException.bind(this));
    }
  }
  onException(exception, hint) {
    ErrorTracking.captureException(this.client, exception, hint);
  }
  async onFatalError() {
    await this.client.shutdown(SHUTDOWN_TIMEOUT);
  }
  isEnabled() {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled;
  }
}

function setupExpressErrorHandler(_posthog, app) {
  app.use((error, _, __, next) => {
    const hint = {
      mechanism: {
        type: 'middleware',
        handled: false
      }
    };
    // Given stateless nature of Node SDK we capture exceptions using personless processing
    // when no user can be determined e.g. in the case of exception autocapture
    ErrorTracking.captureException(_posthog, error, hint, uuidv7(), {
      $process_person_profile: false
    });
    next(error);
  });
}

var version = "4.18.0";

var PostHogPersistedProperty;
(function (PostHogPersistedProperty) {
    PostHogPersistedProperty["AnonymousId"] = "anonymous_id";
    PostHogPersistedProperty["DistinctId"] = "distinct_id";
    PostHogPersistedProperty["Props"] = "props";
    PostHogPersistedProperty["FeatureFlagDetails"] = "feature_flag_details";
    PostHogPersistedProperty["FeatureFlags"] = "feature_flags";
    PostHogPersistedProperty["FeatureFlagPayloads"] = "feature_flag_payloads";
    PostHogPersistedProperty["BootstrapFeatureFlagDetails"] = "bootstrap_feature_flag_details";
    PostHogPersistedProperty["BootstrapFeatureFlags"] = "bootstrap_feature_flags";
    PostHogPersistedProperty["BootstrapFeatureFlagPayloads"] = "bootstrap_feature_flag_payloads";
    PostHogPersistedProperty["OverrideFeatureFlags"] = "override_feature_flags";
    PostHogPersistedProperty["Queue"] = "queue";
    PostHogPersistedProperty["OptedOut"] = "opted_out";
    PostHogPersistedProperty["SessionId"] = "session_id";
    PostHogPersistedProperty["SessionStartTimestamp"] = "session_start_timestamp";
    PostHogPersistedProperty["SessionLastTimestamp"] = "session_timestamp";
    PostHogPersistedProperty["PersonProperties"] = "person_properties";
    PostHogPersistedProperty["GroupProperties"] = "group_properties";
    PostHogPersistedProperty["InstalledAppBuild"] = "installed_app_build";
    PostHogPersistedProperty["InstalledAppVersion"] = "installed_app_version";
    PostHogPersistedProperty["SessionReplay"] = "session_replay";
    PostHogPersistedProperty["DecideEndpointWasHit"] = "decide_endpoint_was_hit";
    PostHogPersistedProperty["SurveyLastSeenDate"] = "survey_last_seen_date";
    PostHogPersistedProperty["SurveysSeen"] = "surveys_seen";
    PostHogPersistedProperty["Surveys"] = "surveys";
    PostHogPersistedProperty["RemoteConfig"] = "remote_config";
})(PostHogPersistedProperty || (PostHogPersistedProperty = {}));
var SurveyPosition;
(function (SurveyPosition) {
    SurveyPosition["Left"] = "left";
    SurveyPosition["Right"] = "right";
    SurveyPosition["Center"] = "center";
})(SurveyPosition || (SurveyPosition = {}));
var SurveyWidgetType;
(function (SurveyWidgetType) {
    SurveyWidgetType["Button"] = "button";
    SurveyWidgetType["Tab"] = "tab";
    SurveyWidgetType["Selector"] = "selector";
})(SurveyWidgetType || (SurveyWidgetType = {}));
var SurveyType;
(function (SurveyType) {
    SurveyType["Popover"] = "popover";
    SurveyType["API"] = "api";
    SurveyType["Widget"] = "widget";
})(SurveyType || (SurveyType = {}));
var SurveyQuestionDescriptionContentType;
(function (SurveyQuestionDescriptionContentType) {
    SurveyQuestionDescriptionContentType["Html"] = "html";
    SurveyQuestionDescriptionContentType["Text"] = "text";
})(SurveyQuestionDescriptionContentType || (SurveyQuestionDescriptionContentType = {}));
var SurveyRatingDisplay;
(function (SurveyRatingDisplay) {
    SurveyRatingDisplay["Number"] = "number";
    SurveyRatingDisplay["Emoji"] = "emoji";
})(SurveyRatingDisplay || (SurveyRatingDisplay = {}));
var SurveyQuestionType;
(function (SurveyQuestionType) {
    SurveyQuestionType["Open"] = "open";
    SurveyQuestionType["MultipleChoice"] = "multiple_choice";
    SurveyQuestionType["SingleChoice"] = "single_choice";
    SurveyQuestionType["Rating"] = "rating";
    SurveyQuestionType["Link"] = "link";
})(SurveyQuestionType || (SurveyQuestionType = {}));
var SurveyQuestionBranchingType;
(function (SurveyQuestionBranchingType) {
    SurveyQuestionBranchingType["NextQuestion"] = "next_question";
    SurveyQuestionBranchingType["End"] = "end";
    SurveyQuestionBranchingType["ResponseBased"] = "response_based";
    SurveyQuestionBranchingType["SpecificQuestion"] = "specific_question";
})(SurveyQuestionBranchingType || (SurveyQuestionBranchingType = {}));
var SurveyMatchType;
(function (SurveyMatchType) {
    SurveyMatchType["Regex"] = "regex";
    SurveyMatchType["NotRegex"] = "not_regex";
    SurveyMatchType["Exact"] = "exact";
    SurveyMatchType["IsNot"] = "is_not";
    SurveyMatchType["Icontains"] = "icontains";
    SurveyMatchType["NotIcontains"] = "not_icontains";
})(SurveyMatchType || (SurveyMatchType = {}));
/** Sync with plugin-server/src/types.ts */
var ActionStepStringMatching;
(function (ActionStepStringMatching) {
    ActionStepStringMatching["Contains"] = "contains";
    ActionStepStringMatching["Exact"] = "exact";
    ActionStepStringMatching["Regex"] = "regex";
})(ActionStepStringMatching || (ActionStepStringMatching = {}));

const normalizeDecideResponse = (decideResponse) => {
    if ('flags' in decideResponse) {
        // Convert v4 format to v3 format
        const featureFlags = getFlagValuesFromFlags(decideResponse.flags);
        const featureFlagPayloads = getPayloadsFromFlags(decideResponse.flags);
        return {
            ...decideResponse,
            featureFlags,
            featureFlagPayloads,
        };
    }
    else {
        // Convert v3 format to v4 format
        const featureFlags = decideResponse.featureFlags ?? {};
        const featureFlagPayloads = Object.fromEntries(Object.entries(decideResponse.featureFlagPayloads || {}).map(([k, v]) => [k, parsePayload(v)]));
        const flags = Object.fromEntries(Object.entries(featureFlags).map(([key, value]) => [
            key,
            getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key]),
        ]));
        return {
            ...decideResponse,
            featureFlags,
            featureFlagPayloads,
            flags,
        };
    }
};
function getFlagDetailFromFlagAndPayload(key, value, payload) {
    return {
        key: key,
        enabled: typeof value === 'string' ? true : value,
        variant: typeof value === 'string' ? value : undefined,
        reason: undefined,
        metadata: {
            id: undefined,
            version: undefined,
            payload: payload ? JSON.stringify(payload) : undefined,
            description: undefined,
        },
    };
}
/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
const getFlagValuesFromFlags = (flags) => {
    return Object.fromEntries(Object.entries(flags ?? {})
        .map(([key, detail]) => [key, getFeatureFlagValue(detail)])
        .filter(([, value]) => value !== undefined));
};
/**
 * Get the payloads from the flags v4 response.
 * @param flags - The flags
 * @returns The payloads
 */
const getPayloadsFromFlags = (flags) => {
    const safeFlags = flags ?? {};
    return Object.fromEntries(Object.keys(safeFlags)
        .filter((flag) => {
        const details = safeFlags[flag];
        return details.enabled && details.metadata && details.metadata.payload !== undefined;
    })
        .map((flag) => {
        const payload = safeFlags[flag].metadata?.payload;
        return [flag, payload ? parsePayload(payload) : undefined];
    }));
};
const getFeatureFlagValue = (detail) => {
    return detail === undefined ? undefined : detail.variant ?? detail.enabled;
};
const parsePayload = (response) => {
    if (typeof response !== 'string') {
        return response;
    }
    try {
        return JSON.parse(response);
    }
    catch {
        return response;
    }
};

// Rollout constants
const NEW_FLAGS_ROLLOUT_PERCENTAGE = 1;
// The fnv1a hashes of the tokens that are explicitly excluded from the rollout
// see https://github.com/PostHog/posthog-js-lite/blob/main/posthog-core/src/utils.ts#L84
// are hashed API tokens from our top 10 for each category supported by this SDK.
const NEW_FLAGS_EXCLUDED_HASHES = new Set([
    // Node
    '61be3dd8',
    '96f6df5f',
    '8cfdba9b',
    'bf027177',
    'e59430a8',
    '7fa5500b',
    '569798e9',
    '04809ff7',
    '0ebc61a5',
    '32de7f98',
    '3beeb69a',
    '12d34ad9',
    '733853ec',
    '0645bb64',
    '5dcbee21',
    'b1f95fa3',
    '2189e408',
    '82b460c2',
    '3a8cc979',
    '29ef8843',
    '2cdbf767',
    '38084b54',
    // React Native
    '50f9f8de',
    '41d0df91',
    '5c236689',
    'c11aedd3',
    'ada46672',
    'f4331ee1',
    '42fed62a',
    'c957462c',
    'd62f705a',
    // Web (lots of teams per org, hence lots of API tokens)
    'e0162666',
    '01b3e5cf',
    '441cef7f',
    'bb9cafee',
    '8f348eb0',
    'b2553f3a',
    '97469d7d',
    '39f21a76',
    '03706dcc',
    '27d50569',
    '307584a7',
    '6433e92e',
    '150c7fbb',
    '49f57f22',
    '3772f65b',
    '01eb8256',
    '3c9e9234',
    'f853c7f7',
    'c0ac4b67',
    'cd609d40',
    '10ca9b1a',
    '8a87f11b',
    '8e8e5216',
    '1f6b63b3',
    'db7943dd',
    '79b7164c',
    '07f78e33',
    '2d21b6fd',
    '952db5ee',
    'a7d3b43f',
    '1924dd9c',
    '84e1b8f6',
    'dff631b6',
    'c5aa8a79',
    'fa133a95',
    '498a4508',
    '24748755',
    '98f3d658',
    '21bbda67',
    '7dbfed69',
    'be3ec24c',
    'fc80b8e2',
    '75cc0998',
]);
const STRING_FORMAT = 'utf8';
function assert(truthyValue, message) {
    if (!truthyValue || typeof truthyValue !== 'string' || isEmpty(truthyValue)) {
        throw new Error(message);
    }
}
function isEmpty(truthyValue) {
    if (truthyValue.trim().length === 0) {
        return true;
    }
    return false;
}
function removeTrailingSlash(url) {
    return url?.replace(/\/+$/, '');
}
async function retriable(fn, props) {
    let lastError = null;
    for (let i = 0; i < props.retryCount + 1; i++) {
        if (i > 0) {
            // don't wait when it's the last try
            await new Promise((r) => setTimeout(r, props.retryDelay));
        }
        try {
            const res = await fn();
            return res;
        }
        catch (e) {
            lastError = e;
            if (!props.retryCheck(e)) {
                throw e;
            }
        }
    }
    throw lastError;
}
function currentTimestamp() {
    return new Date().getTime();
}
function currentISOTime() {
    return new Date().toISOString();
}
function safeSetTimeout(fn, timeout) {
    // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
    // rather than setImmediate.
    const t = setTimeout(fn, timeout);
    // We unref if available to prevent Node.js hanging on exit
    t?.unref && t?.unref();
    return t;
}
function getFetch() {
    return typeof fetch !== 'undefined' ? fetch : typeof globalThis.fetch !== 'undefined' ? globalThis.fetch : undefined;
}
// FNV-1a hash function
// https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
// I know, I know, I'm rolling my own hash function, but I didn't want to take on
// a crypto dependency and this is just temporary anyway
function fnv1a(str) {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    // Convert to hex string, padding to 8 chars
    return (hash >>> 0).toString(16).padStart(8, '0');
}
function isTokenInRollout(token, percentage = 0, excludedHashes) {
    const tokenHash = fnv1a(token);
    // Check excluded hashes (we're explicitly including these tokens from the rollout)
    if (excludedHashes?.has(tokenHash)) {
        return false;
    }
    // Convert hash to int and divide by max value to get number between 0-1
    const hashInt = parseInt(tokenHash, 16);
    const hashFloat = hashInt / 0xffffffff;
    return hashFloat < percentage;
}
function allSettled(promises) {
    return Promise.all(promises.map((p) => (p ?? Promise.resolve()).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))));
}

// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.4.4
// private property
const f = String.fromCharCode;
const keyStrBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const baseReverseDic = {};
function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
        baseReverseDic[alphabet] = {};
        for (let i = 0; i < alphabet.length; i++) {
            baseReverseDic[alphabet][alphabet.charAt(i)] = i;
        }
    }
    return baseReverseDic[alphabet][character];
}
const LZString = {
    compressToBase64: function (input) {
        if (input == null) {
            return '';
        }
        const res = LZString._compress(input, 6, function (a) {
            return keyStrBase64.charAt(a);
        });
        switch (res.length % 4 // To produce valid Base64
        ) {
            default: // When could this happen ?
            case 0:
                return res;
            case 1:
                return res + '===';
            case 2:
                return res + '==';
            case 3:
                return res + '=';
        }
    },
    decompressFromBase64: function (input) {
        if (input == null) {
            return '';
        }
        if (input == '') {
            return null;
        }
        return LZString._decompress(input.length, 32, function (index) {
            return getBaseValue(keyStrBase64, input.charAt(index));
        });
    },
    compress: function (uncompressed) {
        return LZString._compress(uncompressed, 16, function (a) {
            return f(a);
        });
    },
    _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
        if (uncompressed == null) {
            return '';
        }
        const context_dictionary = {}, context_dictionaryToCreate = {}, context_data = [];
        let i, value, context_c = '', context_wc = '', context_w = '', context_enlargeIn = 2, // Compensate for the first entry which should not count
        context_dictSize = 3, context_numBits = 2, context_data_val = 0, context_data_position = 0, ii;
        for (ii = 0; ii < uncompressed.length; ii += 1) {
            context_c = uncompressed.charAt(ii);
            if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
                context_dictionary[context_c] = context_dictSize++;
                context_dictionaryToCreate[context_c] = true;
            }
            context_wc = context_w + context_c;
            if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
                context_w = context_wc;
            }
            else {
                if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                    if (context_w.charCodeAt(0) < 256) {
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = context_data_val << 1;
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 8; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                    else {
                        value = 1;
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1) | value;
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = 0;
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 16; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data.push(getCharFromInt(context_data_val));
                                context_data_val = 0;
                            }
                            else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                    context_enlargeIn--;
                    if (context_enlargeIn == 0) {
                        context_enlargeIn = Math.pow(2, context_numBits);
                        context_numBits++;
                    }
                    delete context_dictionaryToCreate[context_w];
                }
                else {
                    value = context_dictionary[context_w];
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
                // Add wc to the dictionary.
                context_dictionary[context_wc] = context_dictSize++;
                context_w = String(context_c);
            }
        }
        // Output the code for w.
        if (context_w !== '') {
            if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                if (context_w.charCodeAt(0) < 256) {
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = context_data_val << 1;
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                    }
                    value = context_w.charCodeAt(0);
                    for (i = 0; i < 8; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                else {
                    value = 1;
                    for (i = 0; i < context_numBits; i++) {
                        context_data_val = (context_data_val << 1) | value;
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = 0;
                    }
                    value = context_w.charCodeAt(0);
                    for (i = 0; i < 16; i++) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position == bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        }
                        else {
                            context_data_position++;
                        }
                        value = value >> 1;
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
                delete context_dictionaryToCreate[context_w];
            }
            else {
                value = context_dictionary[context_w];
                for (i = 0; i < context_numBits; i++) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position == bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    }
                    else {
                        context_data_position++;
                    }
                    value = value >> 1;
                }
            }
            context_enlargeIn--;
            if (context_enlargeIn == 0) {
                context_enlargeIn = Math.pow(2, context_numBits);
                context_numBits++;
            }
        }
        // Mark the end of the stream
        value = 2;
        for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
            }
            else {
                context_data_position++;
            }
            value = value >> 1;
        }
        // Flush the last char
        while (true) {
            context_data_val = context_data_val << 1;
            if (context_data_position == bitsPerChar - 1) {
                context_data.push(getCharFromInt(context_data_val));
                break;
            }
            else {
                context_data_position++;
            }
        }
        return context_data.join('');
    },
    decompress: function (compressed) {
        if (compressed == null) {
            return '';
        }
        if (compressed == '') {
            return null;
        }
        return LZString._decompress(compressed.length, 32768, function (index) {
            return compressed.charCodeAt(index);
        });
    },
    _decompress: function (length, resetValue, getNextValue) {
        const dictionary = [], result = [], data = { val: getNextValue(0), position: resetValue, index: 1 };
        let enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', i, w, bits, resb, maxpower, power, c;
        for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
        }
        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        switch ((bits)) {
            case 0:
                bits = 0;
                maxpower = Math.pow(2, 8);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 2:
                return '';
        }
        dictionary[3] = c;
        w = c;
        result.push(c);
        while (true) {
            if (data.index > length) {
                return '';
            }
            bits = 0;
            maxpower = Math.pow(2, numBits);
            power = 1;
            while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            switch ((c = bits)) {
                case 0:
                    bits = 0;
                    maxpower = Math.pow(2, 8);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
            if (dictionary[c]) {
                entry = dictionary[c];
            }
            else {
                if (c === dictSize) {
                    entry = w + w.charAt(0);
                }
                else {
                    return null;
                }
            }
            result.push(entry);
            // Add w+entry[0] to the dictionary.
            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    },
};

class SimpleEventEmitter {
    constructor() {
        this.events = {};
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return () => {
            this.events[event] = this.events[event].filter((x) => x !== listener);
        };
    }
    emit(event, payload) {
        for (const listener of this.events[event] || []) {
            listener(payload);
        }
        for (const listener of this.events['*'] || []) {
            listener(event, payload);
        }
    }
}

class PostHogFetchHttpError extends Error {
    constructor(response, reqByteLength) {
        super('HTTP error while fetching PostHog: status=' + response.status + ', reqByteLength=' + reqByteLength);
        this.response = response;
        this.reqByteLength = reqByteLength;
        this.name = 'PostHogFetchHttpError';
    }
    get status() {
        return this.response.status;
    }
    get text() {
        return this.response.text();
    }
    get json() {
        return this.response.json();
    }
}
class PostHogFetchNetworkError extends Error {
    constructor(error) {
        // TRICKY: "cause" is a newer property but is just ignored otherwise. Cast to any to ignore the type issue.
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        super('Network error while fetching PostHog', error instanceof Error ? { cause: error } : {});
        this.error = error;
        this.name = 'PostHogFetchNetworkError';
    }
}
async function logFlushError(err) {
    if (err instanceof PostHogFetchHttpError) {
        let text = '';
        try {
            text = await err.text;
        }
        catch { }
        console.error(`Error while flushing PostHog: message=${err.message}, response body=${text}`, err);
    }
    else {
        console.error('Error while flushing PostHog', err);
    }
    return Promise.resolve();
}
function isPostHogFetchError(err) {
    return typeof err === 'object' && (err instanceof PostHogFetchHttpError || err instanceof PostHogFetchNetworkError);
}
function isPostHogFetchContentTooLargeError(err) {
    return typeof err === 'object' && err instanceof PostHogFetchHttpError && err.status === 413;
}
var QuotaLimitedFeature;
(function (QuotaLimitedFeature) {
    QuotaLimitedFeature["FeatureFlags"] = "feature_flags";
    QuotaLimitedFeature["Recordings"] = "recordings";
})(QuotaLimitedFeature || (QuotaLimitedFeature = {}));
class PostHogCoreStateless {
    constructor(apiKey, options) {
        this.flushPromise = null;
        this.shutdownPromise = null;
        this.pendingPromises = {};
        // internal
        this._events = new SimpleEventEmitter();
        this._isInitialized = false;
        assert(apiKey, "You must pass your PostHog project's api key.");
        this.apiKey = apiKey;
        this.host = removeTrailingSlash(options?.host || 'https://us.i.posthog.com');
        this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20;
        this.maxBatchSize = Math.max(this.flushAt, options?.maxBatchSize ?? 100);
        this.maxQueueSize = Math.max(this.flushAt, options?.maxQueueSize ?? 1000);
        this.flushInterval = options?.flushInterval ?? 10000;
        this.captureMode = options?.captureMode || 'json';
        this.preloadFeatureFlags = options?.preloadFeatureFlags ?? true;
        // If enable is explicitly set to false we override the optout
        this.defaultOptIn = options?.defaultOptIn ?? true;
        this.disableSurveys = options?.disableSurveys ?? false;
        this._retryOptions = {
            retryCount: options?.fetchRetryCount ?? 3,
            retryDelay: options?.fetchRetryDelay ?? 3000,
            retryCheck: isPostHogFetchError,
        };
        this.requestTimeout = options?.requestTimeout ?? 10000; // 10 seconds
        this.featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 3000; // 3 seconds
        this.remoteConfigRequestTimeoutMs = options?.remoteConfigRequestTimeoutMs ?? 3000; // 3 seconds
        this.disableGeoip = options?.disableGeoip ?? true;
        this.disabled = options?.disabled ?? false;
        this.historicalMigration = options?.historicalMigration ?? false;
        // Init promise allows the derived class to block calls until it is ready
        this._initPromise = Promise.resolve();
        this._isInitialized = true;
    }
    logMsgIfDebug(fn) {
        if (this.isDebug) {
            fn();
        }
    }
    wrap(fn) {
        if (this.disabled) {
            this.logMsgIfDebug(() => console.warn('[PostHog] The client is disabled'));
            return;
        }
        if (this._isInitialized) {
            // NOTE: We could also check for the "opt in" status here...
            return fn();
        }
        this._initPromise.then(() => fn());
    }
    getCommonEventProperties() {
        return {
            $lib: this.getLibraryId(),
            $lib_version: this.getLibraryVersion(),
        };
    }
    get optedOut() {
        return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? !this.defaultOptIn;
    }
    async optIn() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false);
        });
    }
    async optOut() {
        this.wrap(() => {
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true);
        });
    }
    on(event, cb) {
        return this._events.on(event, cb);
    }
    debug(enabled = true) {
        this.removeDebugCallback?.();
        if (enabled) {
            const removeDebugCallback = this.on('*', (event, payload) => console.log('PostHog Debug', event, payload));
            this.removeDebugCallback = () => {
                removeDebugCallback();
                this.removeDebugCallback = undefined;
            };
        }
    }
    get isDebug() {
        return !!this.removeDebugCallback;
    }
    get isDisabled() {
        return this.disabled;
    }
    buildPayload(payload) {
        return {
            distinct_id: payload.distinct_id,
            event: payload.event,
            properties: {
                ...(payload.properties || {}),
                ...this.getCommonEventProperties(), // Common PH props
            },
        };
    }
    addPendingPromise(promise) {
        const promiseUUID = uuidv7();
        this.pendingPromises[promiseUUID] = promise;
        promise
            .catch(() => { })
            .finally(() => {
            delete this.pendingPromises[promiseUUID];
        });
        return promise;
    }
    /***
     *** TRACKING
     ***/
    identifyStateless(distinctId, properties, options) {
        this.wrap(() => {
            // The properties passed to identifyStateless are event properties.
            // To add person properties, pass in all person properties to the `$set` and `$set_once` keys.
            const payload = {
                ...this.buildPayload({
                    distinct_id: distinctId,
                    event: '$identify',
                    properties,
                }),
            };
            this.enqueue('identify', payload, options);
        });
    }
    async identifyStatelessImmediate(distinctId, properties, options) {
        const payload = {
            ...this.buildPayload({
                distinct_id: distinctId,
                event: '$identify',
                properties,
            }),
        };
        await this.sendImmediate('identify', payload, options);
    }
    captureStateless(distinctId, event, properties, options) {
        this.wrap(() => {
            const payload = this.buildPayload({ distinct_id: distinctId, event, properties });
            this.enqueue('capture', payload, options);
        });
    }
    async captureStatelessImmediate(distinctId, event, properties, options) {
        const payload = this.buildPayload({ distinct_id: distinctId, event, properties });
        await this.sendImmediate('capture', payload, options);
    }
    aliasStateless(alias, distinctId, properties, options) {
        this.wrap(() => {
            const payload = this.buildPayload({
                event: '$create_alias',
                distinct_id: distinctId,
                properties: {
                    ...(properties || {}),
                    distinct_id: distinctId,
                    alias,
                },
            });
            this.enqueue('alias', payload, options);
        });
    }
    async aliasStatelessImmediate(alias, distinctId, properties, options) {
        const payload = this.buildPayload({
            event: '$create_alias',
            distinct_id: distinctId,
            properties: {
                ...(properties || {}),
                distinct_id: distinctId,
                alias,
            },
        });
        await this.sendImmediate('alias', payload, options);
    }
    /***
     *** GROUPS
     ***/
    groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties) {
        this.wrap(() => {
            const payload = this.buildPayload({
                distinct_id: distinctId || `$${groupType}_${groupKey}`,
                event: '$groupidentify',
                properties: {
                    $group_type: groupType,
                    $group_key: groupKey,
                    $group_set: groupProperties || {},
                    ...(eventProperties || {}),
                },
            });
            this.enqueue('capture', payload, options);
        });
    }
    async getRemoteConfig() {
        await this._initPromise;
        let host = this.host;
        if (host === 'https://us.i.posthog.com') {
            host = 'https://us-assets.i.posthog.com';
        }
        else if (host === 'https://eu.i.posthog.com') {
            host = 'https://eu-assets.i.posthog.com';
        }
        const url = `${host}/array/${this.apiKey}/config`;
        const fetchOptions = {
            method: 'GET',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
        };
        // Don't retry remote config API calls
        return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.remoteConfigRequestTimeoutMs)
            .then((response) => response.json())
            .catch((error) => {
            this.logMsgIfDebug(() => console.error('Remote config could not be loaded', error));
            this._events.emit('error', error);
            return undefined;
        });
    }
    /***
     *** FEATURE FLAGS
     ***/
    async getDecide(distinctId, groups = {}, personProperties = {}, groupProperties = {}, extraPayload = {}) {
        await this._initPromise;
        // Check if the API token is in the new flags rollout
        // This is a temporary measure to ensure that we can still use the old flags API
        // while we migrate to the new flags API
        const useFlags = isTokenInRollout(this.apiKey, NEW_FLAGS_ROLLOUT_PERCENTAGE, NEW_FLAGS_EXCLUDED_HASHES);
        const url = useFlags ? `${this.host}/flags/?v=2` : `${this.host}/decide/?v=4`;
        const fetchOptions = {
            method: 'POST',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: this.apiKey,
                distinct_id: distinctId,
                groups,
                person_properties: personProperties,
                group_properties: groupProperties,
                ...extraPayload,
            }),
        };
        this.logMsgIfDebug(() => console.log('PostHog Debug', 'Decide URL', url));
        // Don't retry /decide API calls
        return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.featureFlagsRequestTimeoutMs)
            .then((response) => response.json())
            .then((response) => normalizeDecideResponse(response))
            .catch((error) => {
            this._events.emit('error', error);
            return undefined;
        });
    }
    async getFeatureFlagStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const flagDetailResponse = await this.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
        if (flagDetailResponse === undefined) {
            // If we haven't loaded flags yet, or errored out, we respond with undefined
            return {
                response: undefined,
                requestId: undefined,
            };
        }
        let response = getFeatureFlagValue(flagDetailResponse.response);
        if (response === undefined) {
            // For cases where the flag is unknown, return false
            response = false;
        }
        // If we have flags we either return the value (true or string) or false
        return {
            response,
            requestId: flagDetailResponse.requestId,
        };
    }
    async getFeatureFlagDetailStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const decideResponse = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [key]);
        if (decideResponse === undefined) {
            return undefined;
        }
        const featureFlags = decideResponse.flags;
        const flagDetail = featureFlags[key];
        return {
            response: flagDetail,
            requestId: decideResponse.requestId,
        };
    }
    async getFeatureFlagPayloadStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const payloads = await this.getFeatureFlagPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [key]);
        if (!payloads) {
            return undefined;
        }
        const response = payloads[key];
        // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
        if (response === undefined) {
            return null;
        }
        return response;
    }
    async getFeatureFlagPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const payloads = (await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate)).payloads;
        return payloads;
    }
    async getFeatureFlagsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        return await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
    }
    async getFeatureFlagsAndPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const featureFlagDetails = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
        if (!featureFlagDetails) {
            return {
                flags: undefined,
                payloads: undefined,
                requestId: undefined,
            };
        }
        return {
            flags: featureFlagDetails.featureFlags,
            payloads: featureFlagDetails.featureFlagPayloads,
            requestId: featureFlagDetails.requestId,
        };
    }
    async getFeatureFlagDetailsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const extraPayload = {};
        if (disableGeoip ?? this.disableGeoip) {
            extraPayload['geoip_disable'] = true;
        }
        if (flagKeysToEvaluate) {
            extraPayload['flag_keys_to_evaluate'] = flagKeysToEvaluate;
        }
        const decideResponse = await this.getDecide(distinctId, groups, personProperties, groupProperties, extraPayload);
        if (decideResponse === undefined) {
            // We probably errored out, so return undefined
            return undefined;
        }
        // if there's an error on the decideResponse, log a console error, but don't throw an error
        if (decideResponse.errorsWhileComputingFlags) {
            console.error('[FEATURE FLAGS] Error while computing feature flags, some flags may be missing or incorrect. Learn more at https://posthog.com/docs/feature-flags/best-practices');
        }
        // Add check for quota limitation on feature flags
        if (decideResponse.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
            console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - feature flags unavailable. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
            return {
                flags: {},
                featureFlags: {},
                featureFlagPayloads: {},
                requestId: decideResponse?.requestId,
            };
        }
        return decideResponse;
    }
    /***
     *** SURVEYS
     ***/
    async getSurveysStateless() {
        await this._initPromise;
        if (this.disableSurveys === true) {
            this.logMsgIfDebug(() => console.log('PostHog Debug', 'Loading surveys is disabled.'));
            return [];
        }
        const url = `${this.host}/api/surveys/?token=${this.apiKey}`;
        const fetchOptions = {
            method: 'GET',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
        };
        const response = await this.fetchWithRetry(url, fetchOptions)
            .then((response) => {
            if (response.status !== 200 || !response.json) {
                const msg = `Surveys API could not be loaded: ${response.status}`;
                const error = new Error(msg);
                this.logMsgIfDebug(() => console.error(error));
                this._events.emit('error', new Error(msg));
                return undefined;
            }
            return response.json();
        })
            .catch((error) => {
            this.logMsgIfDebug(() => console.error('Surveys API could not be loaded', error));
            this._events.emit('error', error);
            return undefined;
        });
        const newSurveys = response?.surveys;
        if (newSurveys) {
            this.logMsgIfDebug(() => console.log('PostHog Debug', 'Surveys fetched from API: ', JSON.stringify(newSurveys)));
        }
        return newSurveys ?? [];
    }
    get props() {
        if (!this._props) {
            this._props = this.getPersistedProperty(PostHogPersistedProperty.Props);
        }
        return this._props || {};
    }
    set props(val) {
        this._props = val;
    }
    async register(properties) {
        this.wrap(() => {
            this.props = {
                ...this.props,
                ...properties,
            };
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    async unregister(property) {
        this.wrap(() => {
            delete this.props[property];
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    /***
     *** QUEUEING AND FLUSHING
     ***/
    enqueue(type, _message, options) {
        this.wrap(() => {
            if (this.optedOut) {
                this._events.emit(type, `Library is disabled. Not sending event. To re-enable, call posthog.optIn()`);
                return;
            }
            const message = this.prepareMessage(type, _message, options);
            const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
            if (queue.length >= this.maxQueueSize) {
                queue.shift();
                this.logMsgIfDebug(() => console.info('Queue is full, the oldest event is dropped.'));
            }
            queue.push({ message });
            this.setPersistedProperty(PostHogPersistedProperty.Queue, queue);
            this._events.emit(type, message);
            // Flush queued events if we meet the flushAt length
            if (queue.length >= this.flushAt) {
                this.flushBackground();
            }
            if (this.flushInterval && !this._flushTimer) {
                this._flushTimer = safeSetTimeout(() => this.flushBackground(), this.flushInterval);
            }
        });
    }
    async sendImmediate(type, _message, options) {
        if (this.disabled) {
            this.logMsgIfDebug(() => console.warn('[PostHog] The client is disabled'));
            return;
        }
        if (!this._isInitialized) {
            await this._initPromise;
        }
        if (this.optedOut) {
            this._events.emit(type, `Library is disabled. Not sending event. To re-enable, call posthog.optIn()`);
            return;
        }
        const data = {
            api_key: this.apiKey,
            batch: [this.prepareMessage(type, _message, options)],
            sent_at: currentISOTime(),
        };
        if (this.historicalMigration) {
            data.historical_migration = true;
        }
        const payload = JSON.stringify(data);
        const url = this.captureMode === 'form'
            ? `${this.host}/e/?ip=1&_=${currentTimestamp()}&v=${this.getLibraryVersion()}`
            : `${this.host}/batch/`;
        const fetchOptions = this.captureMode === 'form'
            ? {
                method: 'POST',
                mode: 'no-cors',
                credentials: 'omit',
                headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(LZString.compressToBase64(payload))}&compression=lz64`,
            }
            : {
                method: 'POST',
                headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
                body: payload,
            };
        try {
            await this.fetchWithRetry(url, fetchOptions);
        }
        catch (err) {
            this._events.emit('error', err);
        }
    }
    prepareMessage(type, _message, options) {
        const message = {
            ..._message,
            type: type,
            library: this.getLibraryId(),
            library_version: this.getLibraryVersion(),
            timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
            uuid: options?.uuid ? options.uuid : uuidv7(),
        };
        const addGeoipDisableProperty = options?.disableGeoip ?? this.disableGeoip;
        if (addGeoipDisableProperty) {
            if (!message.properties) {
                message.properties = {};
            }
            message['properties']['$geoip_disable'] = true;
        }
        if (message.distinctId) {
            message.distinct_id = message.distinctId;
            delete message.distinctId;
        }
        return message;
    }
    clearFlushTimer() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = undefined;
        }
    }
    /**
     * Helper for flushing the queue in the background
     * Avoids unnecessary promise errors
     */
    flushBackground() {
        void this.flush().catch(async (err) => {
            await logFlushError(err);
        });
    }
    /**
     * Flushes the queue
     *
     * This function will return a promise that will resolve when the flush is complete,
     * or reject if there was an error (for example if the server or network is down).
     *
     * If there is already a flush in progress, this function will wait for that flush to complete.
     *
     * It's recommended to do error handling in the callback of the promise.
     *
     * @example
     * posthog.flush().then(() => {
     *   console.log('Flush complete')
     * }).catch((err) => {
     *   console.error('Flush failed', err)
     * })
     *
     *
     * @throws PostHogFetchHttpError
     * @throws PostHogFetchNetworkError
     * @throws Error
     */
    async flush() {
        // Wait for the current flush operation to finish (regardless of success or failure), then try to flush again.
        // Use allSettled instead of finally to be defensive around flush throwing errors immediately rather than rejecting.
        // Use a custom allSettled implementation to avoid issues with patching Promise on RN
        const nextFlushPromise = allSettled([this.flushPromise]).then(() => {
            return this._flush();
        });
        this.flushPromise = nextFlushPromise;
        void this.addPendingPromise(nextFlushPromise);
        allSettled([nextFlushPromise]).then(() => {
            // If there are no others waiting to flush, clear the promise.
            // We don't strictly need to do this, but it could make debugging easier
            if (this.flushPromise === nextFlushPromise) {
                this.flushPromise = null;
            }
        });
        return nextFlushPromise;
    }
    getCustomHeaders() {
        // Don't set the user agent if we're not on a browser. The latest spec allows
        // the User-Agent header (see https://fetch.spec.whatwg.org/#terminology-headers
        // and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader),
        // but browsers such as Chrome and Safari have not caught up.
        const customUserAgent = this.getCustomUserAgent();
        const headers = {};
        if (customUserAgent && customUserAgent !== '') {
            headers['User-Agent'] = customUserAgent;
        }
        return headers;
    }
    async _flush() {
        this.clearFlushTimer();
        await this._initPromise;
        let queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
        if (!queue.length) {
            return;
        }
        const sentMessages = [];
        const originalQueueLength = queue.length;
        while (queue.length > 0 && sentMessages.length < originalQueueLength) {
            const batchItems = queue.slice(0, this.maxBatchSize);
            const batchMessages = batchItems.map((item) => item.message);
            const persistQueueChange = () => {
                const refreshedQueue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
                const newQueue = refreshedQueue.slice(batchItems.length);
                this.setPersistedProperty(PostHogPersistedProperty.Queue, newQueue);
                queue = newQueue;
            };
            const data = {
                api_key: this.apiKey,
                batch: batchMessages,
                sent_at: currentISOTime(),
            };
            if (this.historicalMigration) {
                data.historical_migration = true;
            }
            const payload = JSON.stringify(data);
            const url = this.captureMode === 'form'
                ? `${this.host}/e/?ip=1&_=${currentTimestamp()}&v=${this.getLibraryVersion()}`
                : `${this.host}/batch/`;
            const fetchOptions = this.captureMode === 'form'
                ? {
                    method: 'POST',
                    mode: 'no-cors',
                    credentials: 'omit',
                    headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(LZString.compressToBase64(payload))}&compression=lz64`,
                }
                : {
                    method: 'POST',
                    headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
                    body: payload,
                };
            const retryOptions = {
                retryCheck: (err) => {
                    // don't automatically retry on 413 errors, we want to reduce the batch size first
                    if (isPostHogFetchContentTooLargeError(err)) {
                        return false;
                    }
                    // otherwise, retry on network errors
                    return isPostHogFetchError(err);
                },
            };
            try {
                await this.fetchWithRetry(url, fetchOptions, retryOptions);
            }
            catch (err) {
                if (isPostHogFetchContentTooLargeError(err) && batchMessages.length > 1) {
                    // if we get a 413 error, we want to reduce the batch size and try again
                    this.maxBatchSize = Math.max(1, Math.floor(batchMessages.length / 2));
                    this.logMsgIfDebug(() => console.warn(`Received 413 when sending batch of size ${batchMessages.length}, reducing batch size to ${this.maxBatchSize}`));
                    // do not persist the queue change, we want to retry the same batch
                    continue;
                }
                // depending on the error type, eg a malformed JSON or broken queue, it'll always return an error
                // and this will be an endless loop, in this case, if the error isn't a network issue, we always remove the items from the queue
                if (!(err instanceof PostHogFetchNetworkError)) {
                    persistQueueChange();
                }
                this._events.emit('error', err);
                throw err;
            }
            persistQueueChange();
            sentMessages.push(...batchMessages);
        }
        this._events.emit('flush', sentMessages);
    }
    async fetchWithRetry(url, options, retryOptions, requestTimeout) {
        var _a;
        (_a = AbortSignal).timeout ?? (_a.timeout = function timeout(ms) {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), ms);
            return ctrl.signal;
        });
        const body = options.body ? options.body : '';
        let reqByteLength = -1;
        try {
            reqByteLength = Buffer.byteLength(body, STRING_FORMAT);
        }
        catch {
            const encoded = new TextEncoder().encode(body);
            reqByteLength = encoded.length;
        }
        return await retriable(async () => {
            let res = null;
            try {
                res = await this.fetch(url, {
                    signal: AbortSignal.timeout(requestTimeout ?? this.requestTimeout),
                    ...options,
                });
            }
            catch (e) {
                // fetch will only throw on network errors or on timeouts
                throw new PostHogFetchNetworkError(e);
            }
            // If we're in no-cors mode, we can't access the response status
            // We only throw on HTTP errors if we're not in no-cors mode
            // https://developer.mozilla.org/en-US/docs/Web/API/Request/mode#no-cors
            const isNoCors = options.mode === 'no-cors';
            if (!isNoCors && (res.status < 200 || res.status >= 400)) {
                throw new PostHogFetchHttpError(res, reqByteLength);
            }
            return res;
        }, { ...this._retryOptions, ...retryOptions });
    }
    async _shutdown(shutdownTimeoutMs = 30000) {
        // A little tricky - we want to have a max shutdown time and enforce it, even if that means we have some
        // dangling promises. We'll keep track of the timeout and resolve/reject based on that.
        await this._initPromise;
        let hasTimedOut = false;
        this.clearFlushTimer();
        const doShutdown = async () => {
            try {
                await Promise.all(Object.values(this.pendingPromises));
                while (true) {
                    const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
                    if (queue.length === 0) {
                        break;
                    }
                    // flush again to make sure we send all events, some of which might've been added
                    // while we were waiting for the pending promises to resolve
                    // For example, see sendFeatureFlags in posthog-node/src/posthog-node.ts::capture
                    await this.flush();
                    if (hasTimedOut) {
                        break;
                    }
                }
            }
            catch (e) {
                if (!isPostHogFetchError(e)) {
                    throw e;
                }
                await logFlushError(e);
            }
        };
        return Promise.race([
            new Promise((_, reject) => {
                safeSetTimeout(() => {
                    this.logMsgIfDebug(() => console.error('Timed out while shutting down PostHog'));
                    hasTimedOut = true;
                    reject('Timeout while shutting down PostHog. Some events may not have been sent.');
                }, shutdownTimeoutMs);
            }),
            doShutdown(),
        ]);
    }
    /**
     *  Call shutdown() once before the node process exits, so ensure that all events have been sent and all promises
     *  have resolved. Do not use this function if you intend to keep using this PostHog instance after calling it.
     * @param shutdownTimeoutMs
     */
    async shutdown(shutdownTimeoutMs = 30000) {
        if (this.shutdownPromise) {
            this.logMsgIfDebug(() => console.warn('shutdown() called while already shutting down. shutdown() is meant to be called once before process exit - use flush() for per-request cleanup'));
        }
        else {
            this.shutdownPromise = this._shutdown(shutdownTimeoutMs).finally(() => {
                this.shutdownPromise = null;
            });
        }
        return this.shutdownPromise;
    }
}

/**
 * Fetch wrapper
 *
 * We want to polyfill fetch when not available with axios but use it when it is.
 * NOTE: The current version of Axios has an issue when in non-node environments like Clouflare Workers.
 * This is currently solved by using the global fetch if available instead.
 * See https://github.com/PostHog/posthog-js-lite/issues/127 for more info
 */
let _fetch = getFetch();
if (!_fetch) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  _fetch = async (url, options) => {
    const res = await axios.request({
      url,
      headers: options.headers,
      method: options.method.toLowerCase(),
      data: options.body,
      signal: options.signal,
      // fetch only throws on network errors, not on HTTP errors
      validateStatus: () => true
    });
    return {
      status: res.status,
      text: async () => res.data,
      json: async () => res.data
    };
  };
}
// NOTE: We have to export this as default, even though we prefer named exports as we are relying on detecting "fetch" in the global scope
var fetch$1 = _fetch;

/**
 * A lazy value that is only computed when needed. Inspired by C#'s Lazy<T> class.
 */
class Lazy {
  constructor(factory) {
    this.factory = factory;
  }
  /**
   * Gets the value, initializing it if necessary.
   * Multiple concurrent calls will share the same initialization promise.
   */
  async getValue() {
    if (this.value !== undefined) {
      return this.value;
    }
    if (this.initializationPromise === undefined) {
      this.initializationPromise = (async () => {
        try {
          const result = await this.factory();
          this.value = result;
          return result;
        } finally {
          // Clear the promise so we can retry if needed
          this.initializationPromise = undefined;
        }
      })();
    }
    return this.initializationPromise;
  }
  /**
   * Returns true if the value has been initialized.
   */
  isInitialized() {
    return this.value !== undefined;
  }
  /**
   * Returns a promise that resolves when the value is initialized.
   * If already initialized, resolves immediately.
   */
  async waitForInitialization() {
    if (this.isInitialized()) {
      return;
    }
    await this.getValue();
  }
}

/// <reference lib="dom" />
const nodeCrypto = new Lazy(async () => {
  try {
    return await import('crypto');
  } catch {
    return undefined;
  }
});
async function getNodeCrypto() {
  return await nodeCrypto.getValue();
}
const webCrypto = new Lazy(async () => {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  try {
    // Node.js: use built-in webcrypto and assign it if needed
    const crypto = await nodeCrypto.getValue();
    if (crypto?.webcrypto?.subtle) {
      return crypto.webcrypto.subtle;
    }
  } catch {
    // Ignore if not available
  }
  return undefined;
});
async function getWebCrypto() {
  return await webCrypto.getValue();
}

/// <reference lib="dom" />
async function hashSHA1(text) {
  // Try Node.js crypto first
  const nodeCrypto = await getNodeCrypto();
  if (nodeCrypto) {
    return nodeCrypto.createHash('sha1').update(text).digest('hex');
  }
  const webCrypto = await getWebCrypto();
  // Fall back to Web Crypto API
  if (webCrypto) {
    const hashBuffer = await webCrypto.digest('SHA-1', new TextEncoder().encode(text));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('No crypto implementation available. Tried Node Crypto API and Web SubtleCrypto API');
}

const SIXTY_SECONDS = 60 * 1000;
// eslint-disable-next-line
const LONG_SCALE = 0xfffffffffffffff;
const NULL_VALUES_ALLOWED_OPERATORS = ['is_not'];
class ClientError extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this, this.constructor);
    this.name = 'ClientError';
    this.message = message;
    Object.setPrototypeOf(this, ClientError.prototype);
  }
}
class InconclusiveMatchError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    // instanceof doesn't work in ES3 or ES5
    // https://www.dannyguo.com/blog/how-to-fix-instanceof-not-working-for-custom-errors-in-typescript/
    // this is the workaround
    Object.setPrototypeOf(this, InconclusiveMatchError.prototype);
  }
}
class FeatureFlagsPoller {
  constructor({
    pollingInterval,
    personalApiKey,
    projectApiKey,
    timeout,
    host,
    customHeaders,
    ...options
  }) {
    this.debugMode = false;
    this.shouldBeginExponentialBackoff = false;
    this.backOffCount = 0;
    this.pollingInterval = pollingInterval;
    this.personalApiKey = personalApiKey;
    this.featureFlags = [];
    this.featureFlagsByKey = {};
    this.groupTypeMapping = {};
    this.cohorts = {};
    this.loadedSuccessfullyOnce = false;
    this.timeout = timeout;
    this.projectApiKey = projectApiKey;
    this.host = host;
    this.poller = undefined;
    this.fetch = options.fetch || fetch$1;
    this.onError = options.onError;
    this.customHeaders = customHeaders;
    this.onLoad = options.onLoad;
    void this.loadFeatureFlags();
  }
  debug(enabled = true) {
    this.debugMode = enabled;
  }
  logMsgIfDebug(fn) {
    if (this.debugMode) {
      fn();
    }
  }
  async getFeatureFlag(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}) {
    await this.loadFeatureFlags();
    let response = undefined;
    let featureFlag = undefined;
    if (!this.loadedSuccessfullyOnce) {
      return response;
    }
    for (const flag of this.featureFlags) {
      if (key === flag.key) {
        featureFlag = flag;
        break;
      }
    }
    if (featureFlag !== undefined) {
      try {
        response = await this.computeFlagLocally(featureFlag, distinctId, groups, personProperties, groupProperties);
        this.logMsgIfDebug(() => console.debug(`Successfully computed flag locally: ${key} -> ${response}`));
      } catch (e) {
        if (e instanceof InconclusiveMatchError) {
          this.logMsgIfDebug(() => console.debug(`InconclusiveMatchError when computing flag locally: ${key}: ${e}`));
        } else if (e instanceof Error) {
          this.onError?.(new Error(`Error computing flag locally: ${key}: ${e}`));
        }
      }
    }
    return response;
  }
  async computeFeatureFlagPayloadLocally(key, matchValue) {
    await this.loadFeatureFlags();
    let response = undefined;
    if (!this.loadedSuccessfullyOnce) {
      return undefined;
    }
    if (typeof matchValue == 'boolean') {
      response = this.featureFlagsByKey?.[key]?.filters?.payloads?.[matchValue.toString()];
    } else if (typeof matchValue == 'string') {
      response = this.featureFlagsByKey?.[key]?.filters?.payloads?.[matchValue];
    }
    // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
    if (response === undefined || response === null) {
      return null;
    }
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }
  async getAllFlagsAndPayloads(distinctId, groups = {}, personProperties = {}, groupProperties = {}) {
    await this.loadFeatureFlags();
    const response = {};
    const payloads = {};
    let fallbackToDecide = this.featureFlags.length == 0;
    await Promise.all(this.featureFlags.map(async flag => {
      try {
        const matchValue = await this.computeFlagLocally(flag, distinctId, groups, personProperties, groupProperties);
        response[flag.key] = matchValue;
        const matchPayload = await this.computeFeatureFlagPayloadLocally(flag.key, matchValue);
        if (matchPayload) {
          payloads[flag.key] = matchPayload;
        }
      } catch (e) {
        if (e instanceof InconclusiveMatchError) ; else if (e instanceof Error) {
          this.onError?.(new Error(`Error computing flag locally: ${flag.key}: ${e}`));
        }
        fallbackToDecide = true;
      }
    }));
    return {
      response,
      payloads,
      fallbackToDecide
    };
  }
  async computeFlagLocally(flag, distinctId, groups = {}, personProperties = {}, groupProperties = {}) {
    if (flag.ensure_experience_continuity) {
      throw new InconclusiveMatchError('Flag has experience continuity enabled');
    }
    if (!flag.active) {
      return false;
    }
    const flagFilters = flag.filters || {};
    const aggregation_group_type_index = flagFilters.aggregation_group_type_index;
    if (aggregation_group_type_index != undefined) {
      const groupName = this.groupTypeMapping[String(aggregation_group_type_index)];
      if (!groupName) {
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Unknown group type index ${aggregation_group_type_index} for feature flag ${flag.key}`));
        throw new InconclusiveMatchError('Flag has unknown group type index');
      }
      if (!(groupName in groups)) {
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Can't compute group feature flag: ${flag.key} without group names passed in`));
        return false;
      }
      const focusedGroupProperties = groupProperties[groupName];
      return await this.matchFeatureFlagProperties(flag, groups[groupName], focusedGroupProperties);
    } else {
      return await this.matchFeatureFlagProperties(flag, distinctId, personProperties);
    }
  }
  async matchFeatureFlagProperties(flag, distinctId, properties) {
    const flagFilters = flag.filters || {};
    const flagConditions = flagFilters.groups || [];
    let isInconclusive = false;
    let result = undefined;
    // # Stable sort conditions with variant overrides to the top. This ensures that if overrides are present, they are
    // # evaluated first, and the variant override is applied to the first matching condition.
    const sortedFlagConditions = [...flagConditions].sort((conditionA, conditionB) => {
      const AHasVariantOverride = !!conditionA.variant;
      const BHasVariantOverride = !!conditionB.variant;
      if (AHasVariantOverride && BHasVariantOverride) {
        return 0;
      } else if (AHasVariantOverride) {
        return -1;
      } else if (BHasVariantOverride) {
        return 1;
      } else {
        return 0;
      }
    });
    for (const condition of sortedFlagConditions) {
      try {
        if (await this.isConditionMatch(flag, distinctId, condition, properties)) {
          const variantOverride = condition.variant;
          const flagVariants = flagFilters.multivariate?.variants || [];
          if (variantOverride && flagVariants.some(variant => variant.key === variantOverride)) {
            result = variantOverride;
          } else {
            result = (await this.getMatchingVariant(flag, distinctId)) || true;
          }
          break;
        }
      } catch (e) {
        if (e instanceof InconclusiveMatchError) {
          isInconclusive = true;
        } else {
          throw e;
        }
      }
    }
    if (result !== undefined) {
      return result;
    } else if (isInconclusive) {
      throw new InconclusiveMatchError("Can't determine if feature flag is enabled or not with given properties");
    }
    // We can only return False when all conditions are False
    return false;
  }
  async isConditionMatch(flag, distinctId, condition, properties) {
    const rolloutPercentage = condition.rollout_percentage;
    const warnFunction = msg => {
      this.logMsgIfDebug(() => console.warn(msg));
    };
    if ((condition.properties || []).length > 0) {
      for (const prop of condition.properties) {
        const propertyType = prop.type;
        let matches = false;
        if (propertyType === 'cohort') {
          matches = matchCohort(prop, properties, this.cohorts, this.debugMode);
        } else {
          matches = matchProperty(prop, properties, warnFunction);
        }
        if (!matches) {
          return false;
        }
      }
      if (rolloutPercentage == undefined) {
        return true;
      }
    }
    if (rolloutPercentage != undefined && (await _hash(flag.key, distinctId)) > rolloutPercentage / 100.0) {
      return false;
    }
    return true;
  }
  async getMatchingVariant(flag, distinctId) {
    const hashValue = await _hash(flag.key, distinctId, 'variant');
    const matchingVariant = this.variantLookupTable(flag).find(variant => {
      return hashValue >= variant.valueMin && hashValue < variant.valueMax;
    });
    if (matchingVariant) {
      return matchingVariant.key;
    }
    return undefined;
  }
  variantLookupTable(flag) {
    const lookupTable = [];
    let valueMin = 0;
    let valueMax = 0;
    const flagFilters = flag.filters || {};
    const multivariates = flagFilters.multivariate?.variants || [];
    multivariates.forEach(variant => {
      valueMax = valueMin + variant.rollout_percentage / 100.0;
      lookupTable.push({
        valueMin,
        valueMax,
        key: variant.key
      });
      valueMin = valueMax;
    });
    return lookupTable;
  }
  async loadFeatureFlags(forceReload = false) {
    if (!this.loadedSuccessfullyOnce || forceReload) {
      await this._loadFeatureFlags();
    }
  }
  /**
   * Returns true if the feature flags poller has loaded successfully at least once and has more than 0 feature flags.
   * This is useful to check if local evaluation is ready before calling getFeatureFlag.
   */
  isLocalEvaluationReady() {
    return (this.loadedSuccessfullyOnce ?? false) && (this.featureFlags?.length ?? 0) > 0;
  }
  /**
   * If a client is misconfigured with an invalid or improper API key, the polling interval is doubled each time
   * until a successful request is made, up to a maximum of 60 seconds.
   *
   * @returns The polling interval to use for the next request.
   */
  getPollingInterval() {
    if (!this.shouldBeginExponentialBackoff) {
      return this.pollingInterval;
    }
    return Math.min(SIXTY_SECONDS, this.pollingInterval * 2 ** this.backOffCount);
  }
  async _loadFeatureFlags() {
    if (this.poller) {
      clearTimeout(this.poller);
      this.poller = undefined;
    }
    this.poller = setTimeout(() => this._loadFeatureFlags(), this.getPollingInterval());
    try {
      const res = await this._requestFeatureFlagDefinitions();
      // Handle undefined res case, this shouldn't happen, but it doesn't hurt to handle it anyway
      if (!res) {
        // Don't override existing flags when something goes wrong
        return;
      }
      // NB ON ERROR HANDLING & `loadedSuccessfullyOnce`:
      //
      // `loadedSuccessfullyOnce` indicates we've successfully loaded a valid set of flags at least once.
      // If we set it to `true` in an error scenario (e.g. 402 Over Quota, 401 Invalid Key, etc.),
      // any manual call to `loadFeatureFlags()` (without forceReload) will skip refetching entirely,
      // leaving us stuck with zero or outdated flags. The poller does keep running, but we also want
      // manual reloads to be possible as soon as the error condition is resolved.
      //
      // Therefore, on error statuses, we do *not* set `loadedSuccessfullyOnce = true`, ensuring that
      // both the background poller and any subsequent manual calls can keep trying to load flags
      // once the issue (quota, permission, rate limit, etc.) is resolved.
      switch (res.status) {
        case 401:
          // Invalid API key
          this.shouldBeginExponentialBackoff = true;
          this.backOffCount += 1;
          throw new ClientError(`Your project key or personal API key is invalid. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
        case 402:
          // Quota exceeded - clear all flags
          console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all local flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
          this.featureFlags = [];
          this.featureFlagsByKey = {};
          this.groupTypeMapping = {};
          this.cohorts = {};
          return;
        case 403:
          // Permissions issue
          this.shouldBeginExponentialBackoff = true;
          this.backOffCount += 1;
          throw new ClientError(`Your personal API key does not have permission to fetch feature flag definitions for local evaluation. Setting next polling interval to ${this.getPollingInterval()}ms. Are you sure you're using the correct personal and Project API key pair? More information: https://posthog.com/docs/api/overview`);
        case 429:
          // Rate limited
          this.shouldBeginExponentialBackoff = true;
          this.backOffCount += 1;
          throw new ClientError(`You are being rate limited. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
        case 200:
          {
            // Process successful response
            const responseJson = (await res.json()) ?? {};
            if (!('flags' in responseJson)) {
              this.onError?.(new Error(`Invalid response when getting feature flags: ${JSON.stringify(responseJson)}`));
              return;
            }
            this.featureFlags = responseJson.flags ?? [];
            this.featureFlagsByKey = this.featureFlags.reduce((acc, curr) => (acc[curr.key] = curr, acc), {});
            this.groupTypeMapping = responseJson.group_type_mapping || {};
            this.cohorts = responseJson.cohorts || {};
            this.loadedSuccessfullyOnce = true;
            this.shouldBeginExponentialBackoff = false;
            this.backOffCount = 0;
            this.onLoad?.(this.featureFlags.length);
            break;
          }
        default:
          // Something else went wrong, or the server is down.
          // In this case, don't override existing flags
          return;
      }
    } catch (err) {
      if (err instanceof ClientError) {
        this.onError?.(err);
      }
    }
  }
  getPersonalApiKeyRequestOptions(method = 'GET') {
    return {
      method,
      headers: {
        ...this.customHeaders,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.personalApiKey}`
      }
    };
  }
  async _requestFeatureFlagDefinitions() {
    const url = `${this.host}/api/feature_flag/local_evaluation?token=${this.projectApiKey}&send_cohorts`;
    const options = this.getPersonalApiKeyRequestOptions();
    let abortTimeout = null;
    if (this.timeout && typeof this.timeout === 'number') {
      const controller = new AbortController();
      abortTimeout = safeSetTimeout(() => {
        controller.abort();
      }, this.timeout);
      options.signal = controller.signal;
    }
    try {
      return await this.fetch(url, options);
    } finally {
      clearTimeout(abortTimeout);
    }
  }
  stopPoller() {
    clearTimeout(this.poller);
  }
  _requestRemoteConfigPayload(flagKey) {
    const url = `${this.host}/api/projects/@current/feature_flags/${flagKey}/remote_config/`;
    const options = this.getPersonalApiKeyRequestOptions();
    let abortTimeout = null;
    if (this.timeout && typeof this.timeout === 'number') {
      const controller = new AbortController();
      abortTimeout = safeSetTimeout(() => {
        controller.abort();
      }, this.timeout);
      options.signal = controller.signal;
    }
    try {
      return this.fetch(url, options);
    } finally {
      clearTimeout(abortTimeout);
    }
  }
}
// # This function takes a distinct_id and a feature flag key and returns a float between 0 and 1.
// # Given the same distinct_id and key, it'll always return the same float. These floats are
// # uniformly distributed between 0 and 1, so if we want to show this feature to 20% of traffic
// # we can do _hash(key, distinct_id) < 0.2
async function _hash(key, distinctId, salt = '') {
  const hashString = await hashSHA1(`${key}.${distinctId}${salt}`);
  return parseInt(hashString.slice(0, 15), 16) / LONG_SCALE;
}
function matchProperty(property, propertyValues, warnFunction) {
  const key = property.key;
  const value = property.value;
  const operator = property.operator || 'exact';
  if (!(key in propertyValues)) {
    throw new InconclusiveMatchError(`Property ${key} not found in propertyValues`);
  } else if (operator === 'is_not_set') {
    throw new InconclusiveMatchError(`Operator is_not_set is not supported`);
  }
  const overrideValue = propertyValues[key];
  if (overrideValue == null && !NULL_VALUES_ALLOWED_OPERATORS.includes(operator)) {
    // if the value is null, just fail the feature flag comparison
    // this isn't an InconclusiveMatchError because the property value was provided.
    if (warnFunction) {
      warnFunction(`Property ${key} cannot have a value of null/undefined with the ${operator} operator`);
    }
    return false;
  }
  function computeExactMatch(value, overrideValue) {
    if (Array.isArray(value)) {
      return value.map(val => String(val).toLowerCase()).includes(String(overrideValue).toLowerCase());
    }
    return String(value).toLowerCase() === String(overrideValue).toLowerCase();
  }
  function compare(lhs, rhs, operator) {
    if (operator === 'gt') {
      return lhs > rhs;
    } else if (operator === 'gte') {
      return lhs >= rhs;
    } else if (operator === 'lt') {
      return lhs < rhs;
    } else if (operator === 'lte') {
      return lhs <= rhs;
    } else {
      throw new Error(`Invalid operator: ${operator}`);
    }
  }
  switch (operator) {
    case 'exact':
      return computeExactMatch(value, overrideValue);
    case 'is_not':
      return !computeExactMatch(value, overrideValue);
    case 'is_set':
      return key in propertyValues;
    case 'icontains':
      return String(overrideValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_icontains':
      return !String(overrideValue).toLowerCase().includes(String(value).toLowerCase());
    case 'regex':
      return isValidRegex(String(value)) && String(overrideValue).match(String(value)) !== null;
    case 'not_regex':
      return isValidRegex(String(value)) && String(overrideValue).match(String(value)) === null;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      {
        // :TRICKY: We adjust comparison based on the override value passed in,
        // to make sure we handle both numeric and string comparisons appropriately.
        let parsedValue = typeof value === 'number' ? value : null;
        if (typeof value === 'string') {
          try {
            parsedValue = parseFloat(value);
          } catch (err) {
            // pass
          }
        }
        if (parsedValue != null && overrideValue != null) {
          // check both null and undefined
          if (typeof overrideValue === 'string') {
            return compare(overrideValue, String(value), operator);
          } else {
            return compare(overrideValue, parsedValue, operator);
          }
        } else {
          return compare(String(overrideValue), String(value), operator);
        }
      }
    case 'is_date_after':
    case 'is_date_before':
      {
        let parsedDate = relativeDateParseForFeatureFlagMatching(String(value));
        if (parsedDate == null) {
          parsedDate = convertToDateTime(value);
        }
        if (parsedDate == null) {
          throw new InconclusiveMatchError(`Invalid date: ${value}`);
        }
        const overrideDate = convertToDateTime(overrideValue);
        if (['is_date_before'].includes(operator)) {
          return overrideDate < parsedDate;
        }
        return overrideDate > parsedDate;
      }
    default:
      throw new InconclusiveMatchError(`Unknown operator: ${operator}`);
  }
}
function matchCohort(property, propertyValues, cohortProperties, debugMode = false) {
  const cohortId = String(property.value);
  if (!(cohortId in cohortProperties)) {
    throw new InconclusiveMatchError("can't match cohort without a given cohort property value");
  }
  const propertyGroup = cohortProperties[cohortId];
  return matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode);
}
function matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode = false) {
  if (!propertyGroup) {
    return true;
  }
  const propertyGroupType = propertyGroup.type;
  const properties = propertyGroup.values;
  if (!properties || properties.length === 0) {
    // empty groups are no-ops, always match
    return true;
  }
  let errorMatchingLocally = false;
  if ('values' in properties[0]) {
    // a nested property group
    for (const prop of properties) {
      try {
        const matches = matchPropertyGroup(prop, propertyValues, cohortProperties, debugMode);
        if (propertyGroupType === 'AND') {
          if (!matches) {
            return false;
          }
        } else {
          // OR group
          if (matches) {
            return true;
          }
        }
      } catch (err) {
        if (err instanceof InconclusiveMatchError) {
          if (debugMode) {
            console.debug(`Failed to compute property ${prop} locally: ${err}`);
          }
          errorMatchingLocally = true;
        } else {
          throw err;
        }
      }
    }
    if (errorMatchingLocally) {
      throw new InconclusiveMatchError("Can't match cohort without a given cohort property value");
    }
    // if we get here, all matched in AND case, or none matched in OR case
    return propertyGroupType === 'AND';
  } else {
    for (const prop of properties) {
      try {
        let matches;
        if (prop.type === 'cohort') {
          matches = matchCohort(prop, propertyValues, cohortProperties, debugMode);
        } else {
          matches = matchProperty(prop, propertyValues);
        }
        const negation = prop.negation || false;
        if (propertyGroupType === 'AND') {
          // if negated property, do the inverse
          if (!matches && !negation) {
            return false;
          }
          if (matches && negation) {
            return false;
          }
        } else {
          // OR group
          if (matches && !negation) {
            return true;
          }
          if (!matches && negation) {
            return true;
          }
        }
      } catch (err) {
        if (err instanceof InconclusiveMatchError) {
          if (debugMode) {
            console.debug(`Failed to compute property ${prop} locally: ${err}`);
          }
          errorMatchingLocally = true;
        } else {
          throw err;
        }
      }
    }
    if (errorMatchingLocally) {
      throw new InconclusiveMatchError("can't match cohort without a given cohort property value");
    }
    // if we get here, all matched in AND case, or none matched in OR case
    return propertyGroupType === 'AND';
  }
}
function isValidRegex(regex) {
  try {
    new RegExp(regex);
    return true;
  } catch (err) {
    return false;
  }
}
function convertToDateTime(value) {
  if (value instanceof Date) {
    return value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.valueOf())) {
      return date;
    }
    throw new InconclusiveMatchError(`${value} is in an invalid date format`);
  } else {
    throw new InconclusiveMatchError(`The date provided ${value} must be a string, number, or date object`);
  }
}
function relativeDateParseForFeatureFlagMatching(value) {
  const regex = /^-?(?<number>[0-9]+)(?<interval>[a-z])$/;
  const match = value.match(regex);
  const parsedDt = new Date(new Date().toISOString());
  if (match) {
    if (!match.groups) {
      return null;
    }
    const number = parseInt(match.groups['number']);
    if (number >= 10000) {
      // Guard against overflow, disallow numbers greater than 10_000
      return null;
    }
    const interval = match.groups['interval'];
    if (interval == 'h') {
      parsedDt.setUTCHours(parsedDt.getUTCHours() - number);
    } else if (interval == 'd') {
      parsedDt.setUTCDate(parsedDt.getUTCDate() - number);
    } else if (interval == 'w') {
      parsedDt.setUTCDate(parsedDt.getUTCDate() - number * 7);
    } else if (interval == 'm') {
      parsedDt.setUTCMonth(parsedDt.getUTCMonth() - number);
    } else if (interval == 'y') {
      parsedDt.setUTCFullYear(parsedDt.getUTCFullYear() - number);
    } else {
      return null;
    }
    return parsedDt;
  } else {
    return null;
  }
}

class PostHogMemoryStorage {
  constructor() {
    this._memoryStorage = {};
  }
  getProperty(key) {
    return this._memoryStorage[key];
  }
  setProperty(key, value) {
    this._memoryStorage[key] = value !== null ? value : undefined;
  }
}

// Standard local evaluation rate limit is 600 per minute (10 per second),
// so the fastest a poller should ever be set is 100ms.
const MINIMUM_POLLING_INTERVAL = 100;
const THIRTY_SECONDS = 30 * 1000;
const MAX_CACHE_SIZE = 50 * 1000;
// The actual exported Nodejs API.
class PostHogBackendClient extends PostHogCoreStateless {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this._memoryStorage = new PostHogMemoryStorage();
    this.options = options;
    this.options.featureFlagsPollingInterval = typeof options.featureFlagsPollingInterval === 'number' ? Math.max(options.featureFlagsPollingInterval, MINIMUM_POLLING_INTERVAL) : THIRTY_SECONDS;
    if (options.personalApiKey) {
      if (options.personalApiKey.includes('phc_')) {
        throw new Error('Your Personal API key is invalid. These keys are prefixed with "phx_" and can be created in PostHog project settings.');
      }
      this.featureFlagsPoller = new FeatureFlagsPoller({
        pollingInterval: this.options.featureFlagsPollingInterval,
        personalApiKey: options.personalApiKey,
        projectApiKey: apiKey,
        timeout: options.requestTimeout ?? 10000,
        host: this.host,
        fetch: options.fetch,
        onError: err => {
          this._events.emit('error', err);
        },
        onLoad: count => {
          this._events.emit('localEvaluationFlagsLoaded', count);
        },
        customHeaders: this.getCustomHeaders()
      });
    }
    this.errorTracking = new ErrorTracking(this, options);
    this.distinctIdHasSentFlagCalls = {};
    this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;
  }
  getPersistedProperty(key) {
    return this._memoryStorage.getProperty(key);
  }
  setPersistedProperty(key, value) {
    return this._memoryStorage.setProperty(key, value);
  }
  fetch(url, options) {
    return this.options.fetch ? this.options.fetch(url, options) : fetch$1(url, options);
  }
  getLibraryVersion() {
    return version;
  }
  getCustomUserAgent() {
    return `${this.getLibraryId()}/${this.getLibraryVersion()}`;
  }
  enable() {
    return super.optIn();
  }
  disable() {
    return super.optOut();
  }
  debug(enabled = true) {
    super.debug(enabled);
    this.featureFlagsPoller?.debug(enabled);
  }
  capture(props) {
    if (typeof props === 'string') {
      this.logMsgIfDebug(() => console.warn('Called capture() with a string as the first argument when an object was expected.'));
    }
    const {
      distinctId,
      event,
      properties,
      groups,
      sendFeatureFlags,
      timestamp,
      disableGeoip,
      uuid
    } = props;
    const _capture = props => {
      super.captureStateless(distinctId, event, props, {
        timestamp,
        disableGeoip,
        uuid
      });
    };
    const _getFlags = async (distinctId, groups, disableGeoip) => {
      return (await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)).flags;
    };
    // :TRICKY: If we flush, or need to shut down, to not lose events we want this promise to resolve before we flush
    const capturePromise = Promise.resolve().then(async () => {
      if (sendFeatureFlags) {
        // If we are sending feature flags, we need to make sure we have the latest flags
        // return await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)
        return await _getFlags(distinctId, groups, disableGeoip);
      }
      if (event === '$feature_flag_called') {
        // If we're capturing a $feature_flag_called event, we don't want to enrich the event with cached flags that may be out of date.
        return {};
      }
      if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
        // Otherwise we may as well check for the flags locally and include them if they are already loaded
        const groupsWithStringValues = {};
        for (const [key, value] of Object.entries(groups || {})) {
          groupsWithStringValues[key] = String(value);
        }
        return await this.getAllFlags(distinctId, {
          groups: groupsWithStringValues,
          disableGeoip,
          onlyEvaluateLocally: true
        });
      }
      return {};
    }).then(flags => {
      // Derive the relevant flag properties to add
      const additionalProperties = {};
      if (flags) {
        for (const [feature, variant] of Object.entries(flags)) {
          additionalProperties[`$feature/${feature}`] = variant;
        }
      }
      const activeFlags = Object.keys(flags || {}).filter(flag => flags?.[flag] !== false).sort();
      if (activeFlags.length > 0) {
        additionalProperties['$active_feature_flags'] = activeFlags;
      }
      return additionalProperties;
    }).catch(() => {
      // Something went wrong getting the flag info - we should capture the event anyways
      return {};
    }).then(additionalProperties => {
      // No matter what - capture the event
      _capture({
        ...additionalProperties,
        ...properties,
        $groups: groups
      });
    });
    this.addPendingPromise(capturePromise);
  }
  async captureImmediate(props) {
    if (typeof props === 'string') {
      this.logMsgIfDebug(() => console.warn('Called capture() with a string as the first argument when an object was expected.'));
    }
    const {
      distinctId,
      event,
      properties,
      groups,
      sendFeatureFlags,
      timestamp,
      disableGeoip,
      uuid
    } = props;
    const _capture = props => {
      return super.captureStatelessImmediate(distinctId, event, props, {
        timestamp,
        disableGeoip,
        uuid
      });
    };
    const _getFlags = async (distinctId, groups, disableGeoip) => {
      return (await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)).flags;
    };
    const capturePromise = Promise.resolve().then(async () => {
      if (sendFeatureFlags) {
        // If we are sending feature flags, we need to make sure we have the latest flags
        // return await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)
        return await _getFlags(distinctId, groups, disableGeoip);
      }
      if (event === '$feature_flag_called') {
        // If we're capturing a $feature_flag_called event, we don't want to enrich the event with cached flags that may be out of date.
        return {};
      }
      if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
        // Otherwise we may as well check for the flags locally and include them if they are already loaded
        const groupsWithStringValues = {};
        for (const [key, value] of Object.entries(groups || {})) {
          groupsWithStringValues[key] = String(value);
        }
        return await this.getAllFlags(distinctId, {
          groups: groupsWithStringValues,
          disableGeoip,
          onlyEvaluateLocally: true
        });
      }
      return {};
    }).then(flags => {
      // Derive the relevant flag properties to add
      const additionalProperties = {};
      if (flags) {
        for (const [feature, variant] of Object.entries(flags)) {
          additionalProperties[`$feature/${feature}`] = variant;
        }
      }
      const activeFlags = Object.keys(flags || {}).filter(flag => flags?.[flag] !== false).sort();
      if (activeFlags.length > 0) {
        additionalProperties['$active_feature_flags'] = activeFlags;
      }
      return additionalProperties;
    }).catch(() => {
      // Something went wrong getting the flag info - we should capture the event anyways
      return {};
    }).then(additionalProperties => {
      // No matter what - capture the event
      _capture({
        ...additionalProperties,
        ...properties,
        $groups: groups
      });
    });
    await capturePromise;
  }
  identify({
    distinctId,
    properties,
    disableGeoip
  }) {
    // Catch properties passed as $set and move them to the top level
    // promote $set and $set_once to top level
    const userPropsOnce = properties?.$set_once;
    delete properties?.$set_once;
    // if no $set is provided we assume all properties are $set
    const userProps = properties?.$set || properties;
    super.identifyStateless(distinctId, {
      $set: userProps,
      $set_once: userPropsOnce
    }, {
      disableGeoip
    });
  }
  async identifyImmediate({
    distinctId,
    properties,
    disableGeoip
  }) {
    // promote $set and $set_once to top level
    const userPropsOnce = properties?.$set_once;
    delete properties?.$set_once;
    // if no $set is provided we assume all properties are $set
    const userProps = properties?.$set || properties;
    await super.identifyStatelessImmediate(distinctId, {
      $set: userProps,
      $set_once: userPropsOnce
    }, {
      disableGeoip
    });
  }
  alias(data) {
    super.aliasStateless(data.alias, data.distinctId, undefined, {
      disableGeoip: data.disableGeoip
    });
  }
  async aliasImmediate(data) {
    await super.aliasStatelessImmediate(data.alias, data.distinctId, undefined, {
      disableGeoip: data.disableGeoip
    });
  }
  isLocalEvaluationReady() {
    return this.featureFlagsPoller?.isLocalEvaluationReady() ?? false;
  }
  async waitForLocalEvaluationReady(timeoutMs = THIRTY_SECONDS) {
    if (this.isLocalEvaluationReady()) {
      return true;
    }
    if (this.featureFlagsPoller === undefined) {
      return false;
    }
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      const cleanup = this._events.on('localEvaluationFlagsLoaded', count => {
        clearTimeout(timeout);
        cleanup();
        resolve(count > 0);
      });
    });
  }
  async getFeatureFlag(key, distinctId, options) {
    const {
      groups,
      disableGeoip
    } = options || {};
    let {
      onlyEvaluateLocally,
      sendFeatureFlagEvents,
      personProperties,
      groupProperties
    } = options || {};
    const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
    personProperties = adjustedProperties.allPersonProperties;
    groupProperties = adjustedProperties.allGroupProperties;
    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false;
    }
    if (sendFeatureFlagEvents == undefined) {
      sendFeatureFlagEvents = true;
    }
    let response = await this.featureFlagsPoller?.getFeatureFlag(key, distinctId, groups, personProperties, groupProperties);
    const flagWasLocallyEvaluated = response !== undefined;
    let requestId = undefined;
    let flagDetail = undefined;
    if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
      const remoteResponse = await super.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
      if (remoteResponse === undefined) {
        return undefined;
      }
      flagDetail = remoteResponse.response;
      response = getFeatureFlagValue(flagDetail);
      requestId = remoteResponse?.requestId;
    }
    const featureFlagReportedKey = `${key}_${response}`;
    if (sendFeatureFlagEvents && (!(distinctId in this.distinctIdHasSentFlagCalls) || !this.distinctIdHasSentFlagCalls[distinctId].includes(featureFlagReportedKey))) {
      if (Object.keys(this.distinctIdHasSentFlagCalls).length >= this.maxCacheSize) {
        this.distinctIdHasSentFlagCalls = {};
      }
      if (Array.isArray(this.distinctIdHasSentFlagCalls[distinctId])) {
        this.distinctIdHasSentFlagCalls[distinctId].push(featureFlagReportedKey);
      } else {
        this.distinctIdHasSentFlagCalls[distinctId] = [featureFlagReportedKey];
      }
      this.capture({
        distinctId,
        event: '$feature_flag_called',
        properties: {
          $feature_flag: key,
          $feature_flag_response: response,
          $feature_flag_id: flagDetail?.metadata?.id,
          $feature_flag_version: flagDetail?.metadata?.version,
          $feature_flag_reason: flagDetail?.reason?.description ?? flagDetail?.reason?.code,
          locally_evaluated: flagWasLocallyEvaluated,
          [`$feature/${key}`]: response,
          $feature_flag_request_id: requestId
        },
        groups,
        disableGeoip
      });
    }
    return response;
  }
  async getFeatureFlagPayload(key, distinctId, matchValue, options) {
    const {
      groups,
      disableGeoip
    } = options || {};
    let {
      onlyEvaluateLocally,
      sendFeatureFlagEvents,
      personProperties,
      groupProperties
    } = options || {};
    const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
    personProperties = adjustedProperties.allPersonProperties;
    groupProperties = adjustedProperties.allGroupProperties;
    let response = undefined;
    const localEvaluationEnabled = this.featureFlagsPoller !== undefined;
    if (localEvaluationEnabled) {
      // Try to get match value locally if not provided
      if (!matchValue) {
        matchValue = await this.getFeatureFlag(key, distinctId, {
          ...options,
          onlyEvaluateLocally: true,
          sendFeatureFlagEvents: false
        });
      }
      if (matchValue) {
        response = await this.featureFlagsPoller?.computeFeatureFlagPayloadLocally(key, matchValue);
      }
    }
    //}
    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false;
    }
    if (sendFeatureFlagEvents == undefined) {
      sendFeatureFlagEvents = true;
    }
    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false;
    }
    const payloadWasLocallyEvaluated = response !== undefined;
    if (!payloadWasLocallyEvaluated && !onlyEvaluateLocally) {
      response = await super.getFeatureFlagPayloadStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
    }
    return response;
  }
  async getRemoteConfigPayload(flagKey) {
    return (await this.featureFlagsPoller?._requestRemoteConfigPayload(flagKey))?.json();
  }
  async isFeatureEnabled(key, distinctId, options) {
    const feat = await this.getFeatureFlag(key, distinctId, options);
    if (feat === undefined) {
      return undefined;
    }
    return !!feat || false;
  }
  async getAllFlags(distinctId, options) {
    const response = await this.getAllFlagsAndPayloads(distinctId, options);
    return response.featureFlags || {};
  }
  async getAllFlagsAndPayloads(distinctId, options) {
    const {
      groups,
      disableGeoip
    } = options || {};
    let {
      onlyEvaluateLocally,
      personProperties,
      groupProperties
    } = options || {};
    const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
    personProperties = adjustedProperties.allPersonProperties;
    groupProperties = adjustedProperties.allGroupProperties;
    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false;
    }
    const localEvaluationResult = await this.featureFlagsPoller?.getAllFlagsAndPayloads(distinctId, groups, personProperties, groupProperties);
    let featureFlags = {};
    let featureFlagPayloads = {};
    let fallbackToDecide = true;
    if (localEvaluationResult) {
      featureFlags = localEvaluationResult.response;
      featureFlagPayloads = localEvaluationResult.payloads;
      fallbackToDecide = localEvaluationResult.fallbackToDecide;
    }
    if (fallbackToDecide && !onlyEvaluateLocally) {
      const remoteEvaluationResult = await super.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip);
      featureFlags = {
        ...featureFlags,
        ...(remoteEvaluationResult.flags || {})
      };
      featureFlagPayloads = {
        ...featureFlagPayloads,
        ...(remoteEvaluationResult.payloads || {})
      };
    }
    return {
      featureFlags,
      featureFlagPayloads
    };
  }
  groupIdentify({
    groupType,
    groupKey,
    properties,
    distinctId,
    disableGeoip
  }) {
    super.groupIdentifyStateless(groupType, groupKey, properties, {
      disableGeoip
    }, distinctId);
  }
  /**
   * Reloads the feature flag definitions from the server for local evaluation.
   * This is useful to call if you want to ensure that the feature flags are up to date before calling getFeatureFlag.
   */
  async reloadFeatureFlags() {
    await this.featureFlagsPoller?.loadFeatureFlags(true);
  }
  async _shutdown(shutdownTimeoutMs) {
    this.featureFlagsPoller?.stopPoller();
    return super._shutdown(shutdownTimeoutMs);
  }
  addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties) {
    const allPersonProperties = {
      distinct_id: distinctId,
      ...(personProperties || {})
    };
    const allGroupProperties = {};
    if (groups) {
      for (const groupName of Object.keys(groups)) {
        allGroupProperties[groupName] = {
          $group_key: groups[groupName],
          ...(groupProperties?.[groupName] || {})
        };
      }
    }
    return {
      allPersonProperties,
      allGroupProperties
    };
  }
  captureException(error, distinctId, additionalProperties) {
    const syntheticException = new Error('PostHog syntheticException');
    ErrorTracking.captureException(this, error, {
      syntheticException
    }, distinctId, additionalProperties);
  }
}

// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License
// This was originally forked from https://github.com/csnover/TraceKit, and was largely
// re-written as part of raven - js.
//
// This code was later copied to the JavaScript mono - repo and further modified and
// refactored over the years.
// Copyright (c) 2013 Onur Can Cakmak onur.cakmak@gmail.com and all TraceKit contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files(the 'Software'), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and / or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be included in all copies
// or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
// CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
// OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
const STACKTRACE_FRAME_LIMIT = 50;
const UNKNOWN_FUNCTION = '?';
/** Node Stack line parser */
function node(getModule) {
  const FILENAME_MATCH = /^\s*[-]{4,}$/;
  const FULL_MATCH = /at (?:async )?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/;
  return line => {
    const lineMatch = line.match(FULL_MATCH);
    if (lineMatch) {
      let object;
      let method;
      let functionName;
      let typeName;
      let methodName;
      if (lineMatch[1]) {
        functionName = lineMatch[1];
        let methodStart = functionName.lastIndexOf('.');
        if (functionName[methodStart - 1] === '.') {
          methodStart--;
        }
        if (methodStart > 0) {
          object = functionName.slice(0, methodStart);
          method = functionName.slice(methodStart + 1);
          const objectEnd = object.indexOf('.Module');
          if (objectEnd > 0) {
            functionName = functionName.slice(objectEnd + 1);
            object = object.slice(0, objectEnd);
          }
        }
        typeName = undefined;
      }
      if (method) {
        typeName = object;
        methodName = method;
      }
      if (method === '<anonymous>') {
        methodName = undefined;
        functionName = undefined;
      }
      if (functionName === undefined) {
        methodName = methodName || UNKNOWN_FUNCTION;
        functionName = typeName ? `${typeName}.${methodName}` : methodName;
      }
      let filename = lineMatch[2]?.startsWith('file://') ? lineMatch[2].slice(7) : lineMatch[2];
      const isNative = lineMatch[5] === 'native';
      // If it's a Windows path, trim the leading slash so that `/C:/foo` becomes `C:/foo`
      if (filename?.match(/\/[A-Z]:/)) {
        filename = filename.slice(1);
      }
      if (!filename && lineMatch[5] && !isNative) {
        filename = lineMatch[5];
      }
      return {
        filename: filename ? decodeURI(filename) : undefined,
        module: getModule ? getModule(filename) : undefined,
        function: functionName,
        lineno: _parseIntOrUndefined(lineMatch[3]),
        colno: _parseIntOrUndefined(lineMatch[4]),
        in_app: filenameIsInApp(filename || '', isNative),
        platform: 'node:javascript'
      };
    }
    if (line.match(FILENAME_MATCH)) {
      return {
        filename: line,
        platform: 'node:javascript'
      };
    }
    return undefined;
  };
}
/**
 * Does this filename look like it's part of the app code?
 */
function filenameIsInApp(filename, isNative = false) {
  const isInternal = isNative || filename &&
  // It's not internal if it's an absolute linux path
  !filename.startsWith('/') &&
  // It's not internal if it's an absolute windows path
  !filename.match(/^[A-Z]:/) &&
  // It's not internal if the path is starting with a dot
  !filename.startsWith('.') &&
  // It's not internal if the frame has a protocol. In node, this is usually the case if the file got pre-processed with a bundler like webpack
  !filename.match(/^[a-zA-Z]([a-zA-Z0-9.\-+])*:\/\//); // Schema from: https://stackoverflow.com/a/3641782
  // in_app is all that's not an internal Node function or a module within node_modules
  // note that isNative appears to return true even for node core libraries
  // see https://github.com/getsentry/raven-node/issues/176
  return !isInternal && filename !== undefined && !filename.includes('node_modules/');
}
function _parseIntOrUndefined(input) {
  return parseInt(input || '', 10) || undefined;
}
function nodeStackLineParser(getModule) {
  return [90, node(getModule)];
}
function createStackParser(getModule) {
  const parsers = [nodeStackLineParser(getModule)];
  const sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map(p => p[1]);
  return (stack, skipFirstLines = 0) => {
    const frames = [];
    const lines = stack.split('\n');
    for (let i = skipFirstLines; i < lines.length; i++) {
      const line = lines[i];
      // Ignore lines over 1kb as they are unlikely to be stack frames.
      if (line.length > 1024) {
        continue;
      }
      // https://github.com/getsentry/sentry-javascript/issues/5459
      // Remove webpack (error: *) wrappers
      const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, '$1') : line;
      // https://github.com/getsentry/sentry-javascript/issues/7813
      // Skip Error: lines
      if (cleanedLine.match(/\S*Error: /)) {
        continue;
      }
      for (const parser of sortedParsers) {
        const frame = parser(cleanedLine);
        if (frame) {
          frames.push(frame);
          break;
        }
      }
      if (frames.length >= STACKTRACE_FRAME_LIMIT) {
        break;
      }
    }
    return reverseAndStripFrames(frames);
  };
}
function reverseAndStripFrames(stack) {
  if (!stack.length) {
    return [];
  }
  const localStack = Array.from(stack);
  localStack.reverse();
  return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map(frame => ({
    ...frame,
    filename: frame.filename || getLastStackFrame(localStack).filename,
    function: frame.function || UNKNOWN_FUNCTION
  }));
}
function getLastStackFrame(arr) {
  return arr[arr.length - 1] || {};
}

ErrorTracking.stackParser = createStackParser();
ErrorTracking.frameModifiers = [];
class PostHog extends PostHogBackendClient {
  getLibraryId() {
    return 'posthog-edge';
  }
}

export { PostHog, PostHogSentryIntegration, createEventProcessor, sentryIntegration, setupExpressErrorHandler };
//# sourceMappingURL=index.mjs.map
