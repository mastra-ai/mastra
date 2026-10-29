import { createHash } from 'node:crypto';
import { z } from 'zod';

export const advisoryId = z
  .string()
  .regex(/^(?:CVE-\d{4}-\d{4,}|GHSA-[A-Z0-9-]{14,}|[A-Z0-9][A-Z0-9._:-]{2,79})$/i)
  .max(80);
const short = z.string().max(500);
const instant = z.iso.datetime({ offset: true });
const sourceSchema = z
  .object({ name: short, url: z.url().max(2048), firstSeenAt: instant.optional(), license: short })
  .strict();
const affectedSchema = z.union([
  z.object({ vendor: short, product: short, ranges: z.array(z.unknown()).max(50) }).strict(),
  z
    .object({
      ecosystem: short,
      package: short,
      ranges: z.array(z.unknown()).max(50),
      versions: z.array(short).max(1000),
    })
    .strict(),
]);
export const detailSchema = z
  .object({
    id: advisoryId,
    feedId: z.string().max(100).optional(),
    aliases: z.array(advisoryId).max(32).default([]),
    status: z.enum(['published', 'withdrawn', 'superseded']),
    supersededBy: z.array(advisoryId).max(32).default([]),
    title: short,
    summary: z
      .object({ text: z.string().max(10000), model: short, promptVersion: short })
      .strict()
      .nullable()
      .optional(),
    originalDescription: z.string().max(20000).nullable().optional(),
    severity: z.unknown().optional(),
    statedSeverity: z.unknown().optional(),
    exploitation: z.unknown().optional(),
    ssvc: z.unknown().optional(),
    affected: z.array(affectedSchema).max(100),
    related: z.array(z.unknown()).max(100).optional(),
    bundles: z.array(z.unknown()).max(100).optional(),
    earlyWarning: z.unknown().optional(),
    references: z.array(z.unknown()).max(100).optional(),
    sources: z.array(sourceSchema).min(1).max(30),
    firstSeenAt: instant.optional(),
    publishedAt: instant.optional(),
    modifiedAt: instant,
  })
  .strict();
export type AdvisoryDetail = z.infer<typeof detailSchema>;
export const pageSchema = z
  .object({
    entries: z.array(z.object({ id: advisoryId }).passthrough()).max(100),
    nextCursor: z.string().min(1).max(1024).nullable(),
  })
  .strict();
export const triageSchema = z.object({ status: z.enum(['new', 'triaged', 'investigating', 'closed']) }).strict();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function materialHash(detail: AdvisoryDetail) {
  const material = {
    id: detail.id.toUpperCase(),
    aliases: [...detail.aliases].map(value => value.toUpperCase()).sort(),
    status: detail.status,
    supersededBy: [...detail.supersededBy].map(value => value.toUpperCase()).sort(),
    originalDescription: detail.originalDescription ?? null,
    severity: detail.severity ?? null,
    statedSeverity: detail.statedSeverity ?? null,
    exploitation: detail.exploitation ?? null,
    ssvc: detail.ssvc ?? null,
    affected: detail.affected,
    related: detail.related ?? [],
    bundles: detail.bundles ?? [],
    earlyWarning: detail.earlyWarning ?? null,
    references: detail.references ?? [],
    sources: detail.sources,
  };
  return createHash('sha256').update(canonical(material)).digest('hex');
}

// cve.now range semantics are not fully documented. No positive version claim is made here.
export function versionApplicability(_detail: AdvisoryDetail, _version?: string) {
  return 'APPLICABILITY_UNKNOWN' as const;
}
