/**
 * Biden AI Executive Order
 * https://www.whitehouse.gov/briefing-room/presidential-actions/2023/10/30/executive-order-on-the-safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence/
 */
export const TFLOPS_THRESHOLD_WHITE_HOUSE_MODEL_TRAINING_TOTAL = 10 ** 14;
export const TFLOPS_THRESHOLD_WHITE_HOUSE_MODEL_TRAINING_TOTAL_BIOLOGY = 10 ** 11;
export const TFLOPS_THRESHOLD_WHITE_HOUSE_CLUSTER = 10 ** 8;

/**
 * EU AI Act
 * https://ec.europa.eu/commission/presscorner/detail/en/qanda_21_1683
 */
export const TFLOPS_THRESHOLD_EU_AI_ACT_MODEL_TRAINING_TOTAL = 10 ** 13;

export interface HardwareSpec {
	/**
	 * Approximate value, in FP16 whenever possible.
	 * This is only approximate/theoretical and shouldn't be taken too seriously.
	 * Currently the CPU values are from cpu-monkey.com
	 * while the GPU values are from techpowerup.com
	 *
	 * Note to reviewers: I got fed up with data entry,
	 * and HuggingChat running Llama3 with Web search was failing a bit,
	 * so some of those values might be slightly inaccurate. Forgive me and please feel free to improve.
	 */
	tflops: number;
	/**
	 * If an array is specified, options of memory size (can be VRAM, unified RAM)
	 * e.g. an A100 exists in 40 or 80 GB.
	 */
	memory?: number[];
}

export const DEFAULT_MEMORY_OPTIONS = [8, 16, 24, 32, 40, 48, 64, 80, 96, 128, 256, 512];

export const SKUS = {
	GPU: {
		NVIDIA: {
			H100: {
				tflops: 267.6,
				memory: [80],
			},
			L40: {
				tflops: 90.52,
				memory: [48],
			},
			"RTX 6000 Ada": {
				tflops: 91.1,
				memory: [48],
			},
			"RTX 5880 Ada": {
				tflops: 69.3,
				memory: [48],
			},
			"RTX 5000 Ada": {
				tflops: 65.3,
				memory: [32],
			},
			"RTX 4500 Ada": {
				tflops: 39.6,
				memory: [24],
			},
			"RTX 4000 Ada": {
				tflops: 26.7,
				memory: [20],
			},
			"RTX 4000 SFF Ada": {
				tflops: 19.2,
				memory: [20],
			},
			"RTX 2000 Ada": {
				tflops: 12.0,
				memory: [16],
			},
			"RTX A4000": {
				tflops: 19.2,
				memory: [16],
			},
			A100: {
				tflops: 77.97,
				memory: [80, 40],
			},
			A40: {
				tflops: 37.42,
				memory: [48],
			},
			A10: {
				tflops: 31.24,
				memory: [24],
			},
			A2: {
				tflops: 4.531, // source: https://www.techpowerup.com/gpu-specs/a2.c3848
				memory: [16],
			},
			"RTX 4090": {
				tflops: 82.58,
				memory: [24],
			},
			"RTX 4090D": {
				tflops: 79.49,
				memory: [24],
			},
			"RTX 4080 SUPER": {
				tflops: 52.2,
				memory: [16],
			},
			"RTX 4080": {
				tflops: 48.7,
				memory: [16],
			},
			"RTX 4070": {
				tflops: 29.15,
				memory: [12],
			},
			"RTX 4070 Ti": {
				tflops: 40.09,
				memory: [12],
			},
			"RTX 4070 Super": {
				tflops: 35.48,
				memory: [12],
			},
			"RTX 4070 Ti Super": {
				tflops: 44.1,
				memory: [16],
			},
			"RTX 4060": {
				tflops: 15.11,
				memory: [8],
			},
			"RTX 4060 Ti": {
				tflops: 22.06,
				memory: [8, 16],
			},
			"RTX 3090": {
				tflops: 35.58,
				memory: [24],
			},
			"RTX 3090 Ti": {
				tflops: 40,
				memory: [24],
			},
			"RTX 3080": {
				tflops: 30.6,
				memory: [12, 10],
			},
			"RTX 3080 Ti": {
				tflops: 34.1,
				memory: [12],
			},
			"RTX 3070": {
				tflops: 20.31,
				memory: [8],
			},
			"RTX 3070 Ti": {
				tflops: 21.75,
				memory: [8],
			},
			"RTX 3070 Ti Laptop": {
				tflops: 16.6,
				memory: [8],
			},
			"RTX 3060 Ti": {
				tflops: 16.2,
				memory: [8],
			},
			"RTX 3060": {
				tflops: 12.74,
				memory: [12, 8],
			},
			"RTX 2080 Ti": {
				tflops: 26.9,
				memory: [11],
			},
			"RTX 2080": {
				tflops: 20.14,
				memory: [8],
			},
			"RTX 2070": {
				tflops: 14.93,
				memory: [8],
			},
			"RTX 2070 SUPER Mobile": {
				tflops: 14.13,
				memory: [8],
			},
			"RTX 2070 SUPER": {
				tflops: 18.12,
				memory: [8],
			},
			"RTX 3050 Mobile": {
				tflops: 7.639,
				memory: [6],
			},
			"RTX 2060 Mobile": {
				tflops: 9.22,
				memory: [6],
			},
			"GTX 1080 Ti": {
				tflops: 11.34, // float32 (GPU does not support native float16)
				memory: [11],
			},
			"GTX 1070 Ti": {
				tflops: 8.2, // float32 (GPU does not support native float16)
				memory: [8],
			},
			"RTX Titan": {
				tflops: 32.62,
				memory: [24],
			},
			"GTX 1660": {
				tflops: 10.05,
				memory: [6],
			},
			"GTX 1650 Mobile": {
				tflops: 6.39,
				memory: [4],
			},
			T4: {
				tflops: 65.13,
				memory: [16],
			},
			V100: {
				tflops: 28.26,
				memory: [32, 16],
			},
			"Quadro P6000": {
				tflops: 12.63, // float32 (GPU does not support native float16)
				memory: [24],
			},
			P40: {
				tflops: 11.76, // float32 (GPU does not support native float16)
				memory: [24],
			},
		},
		AMD: {
			MI300: {
				tflops: 383.0,
				memory: [192],
			},
			MI250: {
				tflops: 362.1,
				memory: [128],
			},
			MI210: {
				tflops: 181.0,
				memory: [64],
			},
			MI100: {
				tflops: 184.6,
				memory: [32],
			},
			MI60: {
				tflops: 29.5,
				memory: [32],
			},
			MI50: {
				tflops: 26.5,
				memory: [16],
			},
			"RX 7900 XTX": {
				tflops: 122.8,
				memory: [24],
			},
			"RX 7900 XT": {
				tflops: 103.0,
				memory: [20],
			},
			"RX 7900 GRE": {
				tflops: 91.96,
				memory: [16],
			},
			"RX 7800 XT": {
				tflops: 74.65,
				memory: [16],
			},
			"RX 7700 XT": {
				tflops: 70.34,
				memory: [12],
			},
			"RX 7600 XT": {
				tflops: 45.14,
				memory: [16, 8],
			},
			"RX 6950 XT": {
				tflops: 47.31,
				memory: [16],
			},
			"RX 6800": {
				tflops: 32.33,
				memory: [16],
			},
			"RX 6700 XT": {
				tflops: 26.43,
				memory: [12],
			},
			"RX 6700": {
				tflops: 22.58,
				memory: [10],
			},
			"Radeon Pro VII": {
				tflops: 26.11,
				memory: [16],
			},
		},
		QUALCOMM: {
			"Snapdragon X Elite X1E-00-1DE": {
				tflops: 4.6,
			},
			"Snapdragon X Elite X1E-84-100": {
				tflops: 4.6,
			},
			"Snapdragon X Elite X1E-80-100": {
				tflops: 3.8,
			},
			"Snapdragon X Elite X1E-78-100": {
				tflops: 3.8,
			},
			"Snapdragon X Plus X1P-64-100": {
				tflops: 3.8,
			},
		},
	},
	CPU: {
		Intel: {
			"Xeon 4th Generation (Sapphire Rapids)": {
				tflops: 1.3,
			},
			"Xeon 3th Generation (Ice Lake)": {
				tflops: 0.8,
			},
			"Xeon 2th Generation (Cascade Lake)": {
				tflops: 0.55,
			},
			"Intel Core 13th Generation (i9)": {
				tflops: 0.85,
			},
			"Intel Core 13th Generation (i7)": {
				tflops: 0.82,
			},
			"Intel Core 13th Generation (i5)": {
				tflops: 0.68,
			},
			"Intel Core 13th Generation (i3)": {
				tflops: 0.57,
			},
			"Intel Core 12th Generation (i9)": {
				tflops: 0.79,
			},
			"Intel Core 12th Generation (i7)": {
				tflops: 0.77,
			},
			"Intel Core 12th Generation (i5)": {
				tflops: 0.65,
			},
			"Intel Core 12th Generation (i3)": {
				tflops: 0.53,
			},
			"Intel Core 11th Generation (i9)": {
				tflops: 0.7,
			},
			"Intel Core 11th Generation (i7)": {
				tflops: 0.6,
			},
			"Intel Core 11th Generation (i5)": {
				tflops: 0.5,
			},
			"Intel Core 11th Generation (i3)": {
				tflops: 0.35,
			},
			"Intel Core 10th Generation (i9)": {
				tflops: 0.46,
			},
			"Intel Core 10th Generation (i7)": {
				tflops: 0.46,
			},
			"Intel Core 10th Generation (i5)": {
				tflops: 0.46,
			},
			"Intel Core 10th Generation (i3)": {
				tflops: 0.44,
			},
		},
		AMD: {
			"EPYC 4th Generation (Genoa)": {
				tflops: 5,
			},
			"EPYC 3th Generation (Milan)": {
				tflops: 2.4,
			},
			"EPYC 2th Generation (Rome)": {
				tflops: 0.6,
			},
			"EPYC 1st Generation (Naples)": {
				tflops: 0.6,
			},
			"Ryzen Zen4 7000 (Ryzen 9)": {
				tflops: 0.56,
			},
			"Ryzen Zen4 7000 (Ryzen 7)": {
				tflops: 0.56,
			},
			"Ryzen Zen4 7000 (Ryzen 5)": {
				tflops: 0.56,
			},
			"Ryzen Zen3 5000 (Ryzen 9)": {
				tflops: 1.33,
			},
			"Ryzen Zen3 5000 (Ryzen 7)": {
				tflops: 1.33,
			},
			"Ryzen Zen3 5000 (Ryzen 5)": {
				tflops: 0.72,
			},
			"Ryzen Zen 2  3000 (Threadripper)": {
				tflops: 0.72,
			},
			"Ryzen Zen 2  3000 (Ryzen 9)": {
				tflops: 0.72,
			},
			"Ryzen Zen 2  3000 (Ryzen 7)": {
				tflops: 0.72,
			},
			"Ryzen Zen 2  3000 (Ryzen 5)": {
				tflops: 0.72,
			},
			"Ryzen Zen 2  3000 (Ryzen 3)": {
				tflops: 0.72,
			},
		},
	},
	"Apple Silicon": {
		"-": {
			"Apple M1": {
				tflops: 2.6,
				memory: [8, 16],
			},
			"Apple M1 Pro": {
				tflops: 5.2,
				memory: [16, 24, 32],
			},
			"Apple M1 Max": {
				tflops: 10.4,
				memory: [16, 24, 32, 64],
			},
			"Apple M1 Ultra": {
				tflops: 21,
				memory: [16, 24, 32, 64, 96, 128],
			},
			"Apple M2": {
				tflops: 3.6,
				memory: [8, 16, 24],
			},
			"Apple M2 Pro": {
				tflops: 13.6,
				memory: [16, 24, 32],
			},
			"Apple M2 Max": {
				tflops: 13.49,
				memory: [32, 64, 96],
			},
			"Apple M2 Ultra": {
				tflops: 27.2,
				memory: [64, 96, 128, 192],
			},
			"Apple M3": {
				tflops: 2.84,
				memory: [8, 16, 24],
			},
			"Apple M3 Pro": {
				tflops: 14,
				memory: [18, 36],
			},
			"Apple M3 Max": {
				tflops: 14.2,
				memory: [36, 48, 64, 96, 128],
			},
		},
	},
} satisfies Record<string, Record<string, Record<string, HardwareSpec>>>;

export type SkuType = keyof typeof SKUS;
