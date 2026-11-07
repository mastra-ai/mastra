import { createHash } from 'node:crypto';
import { z } from 'zod';

export const advisoryId = z
  .string()
  .regex(/^(?:CVE-\d{4}-\d{4,}|GHSA-[A-Z0-9-]{14,}|[A-Z0-9][A-Z0-9._:-]{2,79})$/i)
  .max(80);
const short = z.string().max(500);
const instant = z.iso.datetime({ offset: true });
const sourceSchema = z
  .object({
    /** Human-readable label shown in the console. */
    name: short,
    /** Source URL; not permission to dispatch a request. */
    url: z.url().max(2048),
    /** ISO 8601 timestamp when the source first observed the entry. */
    firstSeenAt: instant.optional(),
    /** Source license or attribution label. */
    license: short,
  })
  .strip();
const affectedSchema = z.union([
  z
    .object({
      /** Vendor named by the upstream advisory. */
      vendor: short,
      /** Product named by the upstream advisory. */
      product: short,
      /** Uninterpreted affected-version ranges; no positive applicability is inferred. */
      ranges: z.array(z.unknown()).max(50),
      /** Optional upstream version strings; no positive applicability is inferred. */
      versions: z.array(short).max(1000).optional(),
    })
    .strip(),
  z
    .object({
      /** Package ecosystem named by the upstream advisory. */
      ecosystem: short,
      /** Package name supplied by the upstream advisory. */
      package: short,
      /** Uninterpreted affected-version ranges; no positive applicability is inferred. */
      ranges: z.array(z.unknown()).max(50),
      /** Explicit affected-version strings supplied by the source. */
      versions: z.array(short).max(1000),
      vendor: z.never().optional(),
      product: z.never().optional(),
    })
    .strip()
    .transform(({ vendor: _vendor, product: _product, ...affected }) => affected),
  z
    .object({
      /** Unclassified upstream package name; no ecosystem or version is inferred. */
      package: short,
      /** Uninterpreted affected-version ranges; no positive applicability is inferred. */
      ranges: z.array(z.unknown()).max(50),
      vendor: z.never().optional(),
      product: z.never().optional(),
      ecosystem: z.never().optional(),
      versions: z.never().optional(),
    })
    .strip()
    .transform(
      ({ vendor: _vendor, product: _product, ecosystem: _ecosystem, versions: _versions, ...affected }) => affected,
    ),
]);
/** Validated detail contract; bounds and cross-field rules are enforced before use. */
export const detailSchema = z
  .object({
    /** Stable identifier of this record. */
    id: advisoryId,
    /** Optional upstream feed identifier. */
    feedId: z.string().max(100).optional(),
    /** Alternative upstream identifiers for the same advisory. */
    aliases: z.array(advisoryId).max(32).default([]),
    /** Publisher lifecycle state, separate from local triage. */
    status: z.enum(['published', 'withdrawn', 'superseded', 'rejected', 'provisional']),
    /** Identifiers of advisories replacing this entry. */
    supersededBy: z.array(advisoryId).max(32).default([]),
    /** Upstream advisory title, treated as untrusted data. */
    title: short,
    /** Optional upstream-generated summary and its provenance. */
    summary: z
      .object({
        /** Bounded source text; never an execution instruction. */
        text: z.string().max(10000),
        /** Upstream model label associated with a generated summary. */
        model: short,
        /** Upstream prompt version associated with the summary. */
        promptVersion: short,
      })
      .strip()
      .nullable()
      .optional(),
    /** Bounded original advisory text; treated as untrusted data. */
    originalDescription: z.string().max(20000).nullable().optional(),
    /** Uninterpreted upstream severity metadata. */
    severity: z.unknown().optional(),
    /** Uninterpreted publisher-stated severity metadata. */
    statedSeverity: z.unknown().optional(),
    /** Upstream exposure category, not proof against this target. */
    exposure: z.enum(['Actively exploited', 'Default setups', 'Specific setups only', 'Unclear']).nullable().optional(),
    /** Uninterpreted exploitation metadata, not proof against this target. */
    exploitation: z.unknown().optional(),
    /** Uninterpreted upstream SSVC metadata. */
    ssvc: z.unknown().optional(),
    /** Affected product/package metadata with unverified range semantics. */
    affected: z.array(affectedSchema).max(100),
    /** Uninterpreted related advisory metadata. */
    related: z.array(z.unknown()).max(100).optional(),
    /** Uninterpreted upstream bundle metadata. */
    bundles: z.array(z.unknown()).max(100).optional(),
    /** Uninterpreted upstream early-warning metadata. */
    earlyWarning: z.unknown().optional(),
    /** Uninterpreted upstream reference metadata; never network authorization. */
    references: z.array(z.unknown()).max(100).optional(),
    /** Upstream source attribution and license records. */
    sources: z.array(sourceSchema).min(1).max(30),
    /** ISO 8601 timestamp when the source first observed the entry. */
    firstSeenAt: instant.optional(),
    /** ISO 8601 publication timestamp supplied by the source. */
    publishedAt: instant.nullable().optional(),
    /** ISO 8601 upstream modification timestamp. */
    modifiedAt: instant,
  })
  .strip();
/** Validated bounded upstream advisory; unknown metadata remains untrusted. */
export type AdvisoryDetail = z.infer<typeof detailSchema>;
/** Validated page contract; bounds and cross-field rules are enforced before use. */
export const pageSchema = z
  .object({
    /** Bounded advisory page entries. */
    entries: z
      .array(
        z
          .object({
            /** Stable identifier of this record. */
            id: advisoryId,
          })
          .strip(),
      )
      .max(100),
    /** Opaque continuation cursor, or null at the end of a page. */
    nextCursor: z.string().min(1).max(1024).nullable(),
  })
  .strip();
/** Validated triage contract; bounds and cross-field rules are enforced before use. */
export const triageSchema = z
  .object({
    /** Local operator triage state, separate from the publisher lifecycle. */
    status: z.enum(['new', 'triaged', 'investigating', 'closed']),
  })
  .strict();

/** Serialize material advisory fields with stable object-key ordering for revision hashing. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
/** Hash the canonical advisory fields that define a material revision. */
export function materialHash(detail: AdvisoryDetail) {
  const material = {
    id: detail.id.toUpperCase(),
    aliases: [...detail.aliases].map(value => value.toUpperCase()).sort(),
    status: detail.status,
    supersededBy: [...detail.supersededBy].map(value => value.toUpperCase()).sort(),
    originalDescription: detail.originalDescription ?? null,
    severity: detail.severity ?? null,
    statedSeverity: detail.statedSeverity ?? null,
    exposure: detail.exposure ?? null,
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
