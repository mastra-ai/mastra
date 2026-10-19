import { faker } from '@faker-js/faker';
import { z } from 'zod';
import { domainSchema } from '../../src/mastra/contracts';

export const exampleProfileInputSchema = z.strictObject({
  domain: domainSchema,
  seed: z.number().int().min(0).max(2_147_483_647),
  scenario: z.enum(['recent-inquiry', 'past-inquiry', 'no-inquiry']),
});
export function exampleProfile(input: z.infer<typeof exampleProfileInputSchema>, now = new Date()) {
  const { domain, seed, scenario } = exampleProfileInputSchema.parse(input);
  faker.seed(seed);
  return {
    domain,
    seed,
    scenario,
    contactName: faker.person.fullName(),
    contactEmail: faker.internet.email({ provider: 'example.com' }),
    ...(scenario === 'no-inquiry'
      ? {}
      : {
          inquiry: {
            type: 'demo_request' as const,
            occurredAt: new Date(now.getTime() - (scenario === 'past-inquiry' ? 91 * 86_400_000 : 1000)).toISOString(),
            text: 'Example profile: please demonstrate the product to our purchasing team.',
          },
        }),
  };
}
