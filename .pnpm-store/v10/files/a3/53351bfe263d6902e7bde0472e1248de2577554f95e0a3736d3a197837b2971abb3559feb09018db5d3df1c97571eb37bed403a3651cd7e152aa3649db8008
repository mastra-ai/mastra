import type { ICodec } from "../codecs/ifaces";
import { ScalarCodec } from "../codecs/ifaces";
import type { Client } from "../baseClient";
import { Cardinality } from "./enums";
type QueryType = {
    args: string;
    result: string;
    cardinality: Cardinality;
    capabilities: number;
    query: string;
    importMap: ImportMap;
    imports: Set<string>;
};
export declare function analyzeQuery(client: Client, query: string): Promise<QueryType>;
type AbstractClass<T> = (abstract new (...arguments_: any[]) => T) & {
    prototype: T;
};
type CodecLike = ICodec | ScalarCodec;
export type CodecGenerator<Codec extends CodecLike = CodecLike> = (codec: Codec, context: CodecGeneratorContext) => string;
type CodecGeneratorMap = ReadonlyMap<AbstractClass<CodecLike>, CodecGenerator>;
export type CodecGeneratorContext = {
    indent: string;
    optionalNulls: boolean;
    readonly: boolean;
    imports: ImportMap;
    walk: (codec: CodecLike, context?: CodecGeneratorContext) => string;
    generators: CodecGeneratorMap;
    applyCardinality: (type: string, cardinality: Cardinality) => string;
};
export type CodecGenerationOptions = Partial<Pick<CodecGeneratorContext, "optionalNulls" | "readonly" | "generators" | "applyCardinality">>;
export declare const generateTSTypeFromCodec: (codec: ICodec, cardinality?: Cardinality, options?: CodecGenerationOptions) => {
    type: string;
    imports: ImportMap;
};
declare const genDef: <Codec extends CodecLike>(codecType: AbstractClass<Codec>, generator: CodecGenerator<Codec>) => readonly [AbstractClass<CodecLike>, CodecGenerator<CodecLike>];
export { genDef as defineCodecGeneratorTuple };
type FieldDef = {
    name: string;
    cardinality: Cardinality;
    codec: ICodec;
};
export declare const defaultCodecGenerators: CodecGeneratorMap;
export declare const generateTsObject: (fields: FieldDef[], ctx: CodecGeneratorContext) => string;
export declare const generateTsObjectField: (field: FieldDef, ctx: CodecGeneratorContext) => string;
export declare const defaultApplyCardinalityToTsType: (ctx: Pick<CodecGeneratorContext, "readonly">) => (type: string, cardinality: Cardinality) => string;
export declare class ImportMap extends Map<string, Set<string>> {
    add(module: string, specifier: string): this;
    merge(map: ImportMap): ImportMap;
}
