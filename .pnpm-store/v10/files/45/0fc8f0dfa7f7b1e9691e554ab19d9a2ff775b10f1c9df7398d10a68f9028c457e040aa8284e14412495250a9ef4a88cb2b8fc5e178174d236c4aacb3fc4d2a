export { d as Event, E as EventHandlerCallback, m as EventHandlerResult, k as FormattedItem, j as FormattedProperty, F as FormattedTool, l as MaybeFormattedItem, M as MaybePromise, i as Realtime, R as RealtimeAPI, a as RealtimeClient, f as RealtimeClientEvents, b as RealtimeConversation, h as RealtimeCustomEvents, e as RealtimeEvent, c as RealtimeEventHandler, g as RealtimeServerEvents, T as ToolHandler } from './client-mSdYPPkK.js';
import 'ws';

declare const isBrowser: boolean;
declare function hasNativeWebSocket(): boolean;
declare function getEnv(name: string): string | undefined;
declare function assert(value: unknown, message?: string | Error): asserts value;
/**
 * Converts Float32Array of amplitude data to ArrayBuffer in Int16Array format.
 */
declare function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer;
/**
 * Converts a base64 string to an ArrayBuffer.
 */
declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
/**
 * Converts an ArrayBuffer, Int16Array or Float32Array to a base64 string.
 */
declare function arrayBufferToBase64(arrayBuffer: ArrayBuffer | Int16Array | Float32Array): string;
/**
 * Merge two Int16Arrays from Int16Arrays or ArrayBuffers.
 */
declare function mergeInt16Arrays(left: ArrayBuffer | Int16Array, right: ArrayBuffer | Int16Array): Int16Array;
/**
 * Generates an id to send with events and messages.
 */
declare function generateId(prefix: string, size?: number): string;
declare const sleep: (t: number) => Promise<void>;
/**
 * Trims an event's content for debugging purposes to make logs easier to read.
 */
declare function trimDebugEvent(event?: any, { maxLimit }?: {
    maxLimit?: number;
}): any;

export { arrayBufferToBase64, assert, base64ToArrayBuffer, floatTo16BitPCM, generateId, getEnv, hasNativeWebSocket, isBrowser, mergeInt16Arrays, sleep, trimDebugEvent };
