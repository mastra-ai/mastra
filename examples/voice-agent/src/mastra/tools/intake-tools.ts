import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { checkServiceArea as checkServiceAreaBackend, reconcileIntake } from '../backend';
import type { TradeId } from '../data';

const tradeSchema = z.enum(['plumbing', 'electrical', 'roofing', 'carpentry', 'painting']);

export const checkServiceArea = createTool({
  id: 'checkServiceArea',
  description:
    'Check whether a property is inside the service area before promising a roof inspection or site visit. Pass the property zip code. Returns whether it is in area and the service-area name.',
  inputSchema: z.object({
    zip: z.string().describe('Property zip code, e.g. 94103'),
  }),
  execute: async ({ zip }) => {
    return checkServiceAreaBackend(zip);
  },
});

export const finalizeIntake = createTool({
  id: 'finalizeIntake',
  description:
    'Submit the collected call details to the back office as one reconciled record at the end of the call. Use scenario "lead" for a new job lead (needs trade and a short job description), "inspection" for a roof inspection (needs address and a zip inside the service area), or "callback" for a general message (needs a reason). Always needs name and phone. Returns a reference number to read back, or tells you what is missing or that the address is out of area.',
  inputSchema: z.object({
    scenario: z.enum(['lead', 'inspection', 'callback']),
    name: z.string().optional(),
    phone: z.string().optional(),
    trade: tradeSchema.optional(),
    jobDescription: z.string().optional(),
    address: z.string().optional(),
    zip: z.string().optional(),
    reason: z.string().optional(),
  }),
  execute: async ({ scenario, name, phone, trade, jobDescription, address, zip, reason }) => {
    return reconcileIntake({
      scenario,
      name,
      phone,
      trade: trade as TradeId | undefined,
      jobDescription,
      address,
      zip,
      reason,
    });
  },
});
