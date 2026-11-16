import { z } from 'zod';

export const insuranceProfileSchema = z
  .object({
    id: z.string().min(1).describe('Unique rule identifier within this insurance profile.'),
    version: z
      .string()
      .min(1)
      .describe('Profile version frozen with the analysis; change it whenever profile rules change.'),
    categories: z.array(z.string().min(1)).describe('Insurance term categories recognized by this profile.'),
    terminology: z
      .record(z.string(), z.string().min(1))
      .describe('Company or product terminology supplied as extraction context.'),
    rules: z
      .array(
        z
          .object({
            id: z.string().min(1).describe('Stable profile or rule identifier; unique within its registry.'),
            description: z.string().min(1).describe('Human-readable explanation of the profile rule.'),
            category: z.string().min(1).describe('Term category, or provider category selecting its supported stage.'),
            key: z.string().min(1).describe('Stable term key within its category and documented scope.'),
            requirement: z
              .enum(['required', 'review'])
              .describe('Require a documented target term or request explicit broker review.'),
          })
          .strict(),
      )
      .describe('Profile-rule observations kept separate from contractual evidence.'),
  })
  .strict()
  .refine(
    profile => new Set(profile.rules.map(rule => rule.id)).size === profile.rules.length,
    'Rule IDs must be unique within a profile.',
  );
export const insuranceProfiles = [
  { id: 'generic', version: '1', categories: [], terminology: {}, rules: [] },
] satisfies z.infer<typeof insuranceProfileSchema>[];
export const defaultInsuranceProfile = 'generic';

export const insuranceConfigurationSchema = z
  .object({
    profiles: z
      .array(insuranceProfileSchema)
      .min(1)
      .describe('Registered insurance profiles with unique stable identifiers.'),
    defaultProfileId: z.string().min(1).describe('Identifier of one registered profile used as the default.'),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (new Set(configuration.profiles.map(profile => profile.id)).size !== configuration.profiles.length)
      context.addIssue({ code: 'custom', path: ['profiles'], message: 'Insurance profile IDs must be unique.' });
    if (!configuration.profiles.some(profile => profile.id === configuration.defaultProfileId))
      context.addIssue({
        code: 'custom',
        path: ['defaultProfileId'],
        message: 'Choose a registered insurance profile ID.',
      });
  });
export const insuranceConfiguration = { profiles: insuranceProfiles, defaultProfileId: defaultInsuranceProfile };
