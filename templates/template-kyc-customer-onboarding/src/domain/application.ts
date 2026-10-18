import { z } from 'zod';

import { applicationIdSchema, caseIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';

export const postalAddressSchema = z
  .object({
    line1: z.string().min(1).max(200),
    line2: z.string().min(1).max(200).optional(),
    city: z.string().min(1).max(120),
    region: z.string().min(1).max(120),
    postalCode: z.string().min(1).max(32),
    country: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/u),
  })
  .strict();

export const applicationDataSchema = z
  .object({
    fullName: z.string().min(1).max(200),
    dateOfBirth: z.iso.date(),
    nationality: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/u),
    email: z.email(),
    phone: z.string().min(7).max(32),
    documentNumber: z.string().min(1).max(100).optional(),
    expirationDate: z.iso.date().optional(),
    residentialAddress: postalAddressSchema,
  })
  .strict();

export const applicationCorrectionsSchema = applicationDataSchema
  .pick({
    fullName: true,
    dateOfBirth: true,
    documentNumber: true,
    expirationDate: true,
    residentialAddress: true,
  })
  .partial()
  .strict()
  .refine(value => Object.keys(value).length > 0, {
    message: 'at least one application correction is required',
  });

export const applicationSchema = z
  .object({
    id: applicationIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    data: applicationDataSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export type PostalAddress = z.infer<typeof postalAddressSchema>;
export type ApplicationData = z.infer<typeof applicationDataSchema>;
export type ApplicationCorrections = z.infer<typeof applicationCorrectionsSchema>;
export type Application = z.infer<typeof applicationSchema>;
