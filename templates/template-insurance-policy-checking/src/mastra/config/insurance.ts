import { z } from 'zod';

export const insuranceProfileSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    categories: z.array(z.string().min(1)),
    terminology: z.record(z.string(), z.string().min(1)),
    rules: z.array(
      z
        .object({
          id: z.string().min(1),
          description: z.string().min(1),
          category: z.string().min(1),
          key: z.string().min(1),
          requirement: z.enum(['required', 'review']),
        })
        .strict(),
    ),
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
    profiles: z.array(insuranceProfileSchema).min(1),
    defaultProfileId: z.string().min(1),
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
