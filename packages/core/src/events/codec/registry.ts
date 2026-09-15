/**
 * Class registry for the pubsub frame codec. Lets non-plain class instances
 * (e.g. GeneratedFile) survive a JSON round-trip across the unix-socket
 * pubsub transport.
 *
 * The registry is closed: only classes registered here can be reconstructed.
 * Unknown class names decode to plain data so we never instantiate
 * user-controlled prototypes.
 */
export interface ClassCodec<T = unknown, D = unknown> {
  /** Convert an instance to JSON-safe data. */
  toData(instance: T): D;
  /** Reconstruct an instance from previously serialized data. */
  fromData(data: D): T;
}

const classRegistry = new Map<string, ClassCodec>();

export function registerClass<T, D>(name: string, codec: ClassCodec<T, D>): void {
  classRegistry.set(name, codec as ClassCodec);
}

export function unregisterClass(name: string): void {
  classRegistry.delete(name);
}

export function getClassCodec(name: string): ClassCodec | undefined {
  return classRegistry.get(name);
}

export function hasClassCodec(name: string): boolean {
  return classRegistry.has(name);
}
