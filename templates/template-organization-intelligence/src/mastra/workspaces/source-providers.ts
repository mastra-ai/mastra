import { z } from 'zod';

export const sourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  provider: z.string(),
  mountPath: z.string(),
  enabled: z.boolean(),
  displayName: z.string().min(1).optional(),
});

export const localSourceSchema = sourceSchema.extend({
  provider: z.literal('local'),
  root: z.string().min(1),
});

export const googleDriveSourceSchema = sourceSchema.extend({
  provider: z.literal('google-drive'),
  folderId: z.string().min(1),
  credentialRef: z.literal('organization'),
});

export const s3SourceSchema = sourceSchema.extend({
  provider: z.literal('s3'),
  bucket: z.string().min(3).max(63),
  endpoint: z.string().url(),
  region: z.string().min(1),
  prefix: z.string().optional(),
  credentialRef: z.literal('organization'),
});

export const catalogSourceSchema = z.discriminatedUnion('provider', [
  localSourceSchema,
  googleDriveSourceSchema,
  s3SourceSchema,
]);

export type LocalSource = z.infer<typeof localSourceSchema>;
export type GoogleDriveSource = z.infer<typeof googleDriveSourceSchema>;
export type S3Source = z.infer<typeof s3SourceSchema>;
export type CatalogSource = LocalSource | GoogleDriveSource | S3Source;

function unsupportedProvider(source: never): never {
  throw new Error(`Unsupported source provider: ${String(source)}`);
}

export function sourceIdentity(source: CatalogSource): string {
  switch (source.provider) {
    case 'local':
      return source.root;
    case 'google-drive':
      return source.folderId;
    case 's3':
      return JSON.stringify({ endpoint: source.endpoint, bucket: source.bucket, prefix: source.prefix ?? '' });
    default:
      return unsupportedProvider(source);
  }
}
