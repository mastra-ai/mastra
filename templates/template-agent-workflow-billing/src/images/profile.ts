import { z } from 'zod';
import { BillingError } from '../billing/contracts/core.js';

const profileSchema = z.strictObject({
  model: z.string().trim().min(1).max(128),
  n: z.literal(1),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']),
  quality: z.enum(['low', 'medium', 'high', 'auto']),
  output_format: z.literal('png'),
});

/** Server defaults; credentials and per-request input cannot override this profile. */
export const imageProfile = Object.freeze({
  model: 'gpt-image-2.5-flare',
  n: 1,
  size: '1024x1024',
  quality: 'low',
  output_format: 'png',
} as const);

/** Read optional operator overrides while preserving one-image, PNG billing invariants. */
export function readImageProfile(environment: NodeJS.ProcessEnv) {
  const result = profileSchema.safeParse({
    ...imageProfile,
    model: environment.OPENAI_IMAGE_MODEL ?? imageProfile.model,
    size: environment.OPENAI_IMAGE_SIZE ?? imageProfile.size,
    quality: environment.OPENAI_IMAGE_QUALITY ?? imageProfile.quality,
  });
  if (!result.success) throw new BillingError('invalid_configuration');
  return Object.freeze(result.data);
}
