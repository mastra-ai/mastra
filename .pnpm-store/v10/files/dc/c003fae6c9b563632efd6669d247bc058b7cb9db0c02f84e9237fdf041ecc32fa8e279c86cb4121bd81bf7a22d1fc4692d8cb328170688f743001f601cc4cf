export type Parse11Options = {
	withLongNumerals?: boolean;
};
export declare function parse<T = any>(text: string, reviver?: ((this: any, key: string, value: any) => any) | null, options?: Parse11Options): T;
export type AllowList = (string | number)[];
export type Replacer = (this: any, key: string, value: any) => any;
export type StringifyQuoteOptions = {
	quote?: string;
	quoteNames?: boolean;
};
export type Stringify11Options = StringifyQuoteOptions & {
	withBigInt?: boolean;
	trailingComma?: boolean;
	withLegacyEscapes?: boolean;
};
export type StringifyOptions = Stringify11Options & {
	replacer?: Replacer | AllowList | null;
	space?: string | number | String | Number | null;
};
export declare function stringify(value: any, options?: StringifyOptions): string | undefined;
export declare function stringify(value: any, replacer?: Replacer | null, space?: string | number | String | Number | null, options?: Stringify11Options): string | undefined;
export declare function stringify(value: any, allowList?: AllowList, space?: string | number | String | Number | null, options?: Stringify11Options): string | undefined;

export as namespace JSON11;

export {};
