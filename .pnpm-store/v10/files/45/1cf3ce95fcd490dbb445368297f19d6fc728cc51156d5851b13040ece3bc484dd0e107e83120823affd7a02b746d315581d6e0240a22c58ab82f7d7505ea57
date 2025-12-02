import type { ScalarCodec } from "./ifaces";
import type { Codecs } from "./codecs";
export type CodecValueType<S> = S extends Codecs.KnownCodecs[keyof Codecs.KnownCodecs] ? S extends Codecs.Codec<infer T> ? T : never : never;
export type MutableCodecMap = Map<string, Codecs.AnyCodec>;
export type ReadonlyCodecMap = ReadonlyMap<string, Codecs.AnyCodec>;
type ContainerNames = keyof Codecs.ContainerCodecs;
type ContainerOverload<T extends ContainerNames> = Codecs.ContainerCodecs[T] | undefined;
export declare class CodecContext {
    private readonly spec;
    private readonly map;
    constructor(spec: ReadonlyCodecMap | null);
    private initCodec;
    getContainerOverload<T extends ContainerNames>(kind: T): ContainerOverload<T>;
    hasOverload(codec: ScalarCodec): boolean;
    postDecode<T>(codec: ScalarCodec, value: CodecValueType<T>): any;
    preEncode<T>(codec: ScalarCodec, value: any): CodecValueType<T>;
}
export declare const NOOP_CODEC_CONTEXT: CodecContext;
export {};
