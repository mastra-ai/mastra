import { exampleProfiles, exampleReviewers, exampleStudioRole, retailProfiles } from './retail-pos/profiles.ts';
import type { Profile } from '../mastra/identity.ts';

export const integrationProfiles: Profile[] = [
  { id: 'integration-team', actorId: 'morgan', tenantId: 'software', customerId: 'example-app' },
  { id: 'integration-colleague', actorId: 'taylor', tenantId: 'software', customerId: 'example-app' },
];
export const integrationReviewers: Profile[] = [
  { id: 'integration-reviewer', actorId: 'jamie', tenantId: 'software', customerId: 'example-app' },
];

/** Only trusted process configuration selects an example, never a request or model argument. */
interface RuntimeExample {
  id: string;
  initialDataset: string;
  profiles: Profile[];
  reviewers: Profile[];
  role: string;
  topicTerms: Record<string, string[]>;
  instructions: string;
}
export function selectExample(name = process.env.SUPPORT_EXAMPLE ?? 'retail-pos'): RuntimeExample {
  if (name === 'retail-pos')
    return {
      id: name,
      initialDataset: 'retail-pos-docs',
      profiles: [...exampleProfiles, ...retailProfiles],
      reviewers: exampleReviewers,
      role: exampleStudioRole,
      topicTerms: {
        connectivity: ['connectivity', 'connection', 'network', 'wifi', 'wi-fi', 'offline', 'cable'],
        payments: ['payment', 'payments', 'pending', 'offline'],
        printing: ['printer', 'printing', 'receipt', 'ethernet', 'bluetooth', 'usb'],
      },
      instructions:
        'Help technicians troubleshoot Retail POS and Square Terminal connectivity, payments, and printers. Advise only; never operate hardware or handle payment data. Ask whether payments are pending and which connection indicator is visible when those facts are missing.',
    };
  if (name === 'software-integration')
    return {
      id: name,
      initialDataset: 'software-integration',
      profiles: integrationProfiles,
      reviewers: integrationReviewers,
      role: exampleStudioRole,
      topicTerms: { requests: ['request', 'requests', '401', 'unauthorized', 'authentication', 'credentials', 'http'] },
      instructions:
        'Help developers diagnose HTTP integration authentication failures using the public HTTP reference and fictional case evidence. Ask for the response status and authentication challenge scheme without requesting credentials. Advise only; never send requests or rotate credentials. Distinguish a 401 response from an observed confirmed resolution.',
    };
  throw new Error('Choose SUPPORT_EXAMPLE retail-pos or software-integration');
}
export const runtimeExample = selectExample();
