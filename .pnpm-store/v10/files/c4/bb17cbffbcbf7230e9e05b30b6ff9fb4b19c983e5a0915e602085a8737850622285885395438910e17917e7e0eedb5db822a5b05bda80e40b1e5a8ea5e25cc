export enum GGMLQuantizationType {
	F32 = 0,
	F16 = 1,
	Q4_0 = 2,
	Q4_1 = 3,
	Q5_0 = 6,
	Q5_1 = 7,
	Q8_0 = 8,
	Q8_1 = 9,
	Q2_K = 10,
	Q3_K = 11,
	Q4_K = 12,
	Q5_K = 13,
	Q6_K = 14,
	Q8_K = 15,
	IQ2_XXS = 16,
	IQ2_XS = 17,
	IQ3_XXS = 18,
	IQ1_S = 19,
	IQ4_NL = 20,
	IQ3_S = 21,
	IQ2_S = 22,
	IQ4_XS = 23,
	I8 = 24,
	I16 = 25,
	I32 = 26,
	I64 = 27,
	F64 = 28,
	IQ1_M = 29,
	BF16 = 30,
}

const ggufQuants = Object.values(GGMLQuantizationType).filter((v): v is string => typeof v === "string");
export const GGUF_QUANT_RE = new RegExp(`(?<quant>${ggufQuants.join("|")})` + "(_(?<sizeVariation>[A-Z]+))?");
export const GGUF_QUANT_RE_GLOBAL = new RegExp(GGUF_QUANT_RE, "g");

export function parseGGUFQuantLabel(fname: string): string | undefined {
	const quantLabel = fname.toUpperCase().match(GGUF_QUANT_RE_GLOBAL)?.at(-1); // if there is multiple quant substrings in a name, we prefer the last one
	return quantLabel;
}
