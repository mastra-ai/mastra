import { z } from "zod";

// Helper for aspect ratio validation
const VALID_ASPECT_RATIOS = [
  "16:9",
  "1:1",
  "21:9",
  "2:3",
  "3:2",
  "4:5",
  "5:4",
  "9:16",
  "9:21",
] as const;

// Helper for output format validation
const VALID_OUTPUT_FORMATS = ["jpeg", "png", "webp"] as const;

export const generationRequestSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(10000),

  negative_prompt: z.string().max(10000).optional(),

  aspect_ratio: z.enum(VALID_ASPECT_RATIOS).default("1:1"),

  seed: z
    .number()
    .int()
    .min(0)
    .max(4294967294)
    .default(0),

  output_format: z.enum(VALID_OUTPUT_FORMATS).default("png"),

  image: z
    .string()
    .optional(),

  strength: z
    .number()
    .min(0)
    .max(1)
    .optional()
});

// Type inference from schemas
export type GenerationRequest = z.infer<typeof generationRequestSchema>;