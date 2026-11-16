import { z } from 'zod';
import { identifierSchema } from '../../contracts/core.js';

export const bindingSchema = z
  .strictObject({
    customers: z
      .array(
        z.strictObject({
          workspaceId: identifierSchema,
          customerId: identifierSchema,
          name: z.string().trim().min(1).max(200).optional(),
          email: z.email().optional(),
        }),
      )
      .min(1)
      .max(1000),
    meters: z
      .array(z.strictObject({ key: identifierSchema, featureId: identifierSchema, creditPoolId: identifierSchema }))
      .min(1)
      .max(100),
    subscriptions: z
      .array(z.strictObject({ key: identifierSchema, planId: identifierSchema }))
      .max(100)
      .default([]),
    entitlements: z
      .array(z.strictObject({ key: identifierSchema, featureId: identifierSchema }))
      .max(100)
      .default([]),
    plans: z
      .array(z.strictObject({ key: identifierSchema, planId: identifierSchema }))
      .max(100)
      .default([]),
    returnUrls: z.array(z.url()).max(100).default([]),
  })
  .superRefine((value, ctx) => {
    for (const keys of [
      value.customers.map(row => row.workspaceId),
      value.customers.map(row => row.customerId),
      value.meters.map(row => row.key),
      value.entitlements.map(row => row.key),
      value.subscriptions.map(row => row.key),
      value.plans.map(row => row.key),
    ])
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({ code: 'custom', message: 'Autumn bindings must be unique.' });
    for (const valueUrl of value.returnUrls) {
      const url = new URL(valueUrl);
      if (
        url.username ||
        url.password ||
        url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid return URL.' });
    }
  });
