import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { samQuery } from './helpers';

export const sentinelSamEntitySearch = createTool({
  id: 'sentinel-sam-entity-search',
  description:
    'Search the SAM.gov federal entity registry by business name, UEI, or CAGE code. Returns registration status, entity type, physical address, and exclusion flags. Essential for vendor due diligence. Requires SAM_GOV_API_KEY env var. Free tier: 10 requests/day.',
  inputSchema: z.object({
    legal_business_name: z.string().optional().describe('Full or partial business name'),
    uei_sam: z.string().optional().describe('12-character Unique Entity Identifier'),
    cage_code: z.string().optional().describe('5-character CAGE code'),
    registration_status: z
      .enum(['A', 'E', 'W', 'D'])
      .optional()
      .describe('A=Active, E=Expired, W=Work in Progress, D=Deleted'),
    page: z.number().int().default(0).describe('Page number (0-indexed)'),
  }),
  execute: async ({ legal_business_name, uei_sam, cage_code, registration_status, page }) => {
    const params: Record<string, string> = {};
    if (legal_business_name) params.legalBusinessName = legal_business_name;
    if (uei_sam) params.ueiSAM = uei_sam;
    if (cage_code) params.cageCode = cage_code;
    if (registration_status) params.registrationStatus = registration_status;
    params.page = String(page);

    const data = (await samQuery(params)) as {
      totalRecords?: number;
      entityData?: Array<Record<string, unknown>>;
    };

    return {
      total_records: data.totalRecords ?? 0,
      entities: data.entityData ?? [],
    };
  },
});

export const sentinelSamExclusionCheck = createTool({
  id: 'sentinel-sam-exclusion-check',
  description:
    'Check if a vendor or entity is on the SAM.gov exclusion list (debarred, suspended, or otherwise excluded from federal contracts and grants). Critical for compliance verification before awarding contracts. Requires SAM_GOV_API_KEY env var.',
  inputSchema: z.object({
    legal_business_name: z.string().optional().describe('Business name to check'),
    uei_sam: z.string().optional().describe('Unique Entity Identifier to check'),
  }),
  execute: async ({ legal_business_name, uei_sam }) => {
    const params: Record<string, string> = {
      exclusionStatusFlag: 'Y',
    };
    if (legal_business_name) params.legalBusinessName = legal_business_name;
    if (uei_sam) params.ueiSAM = uei_sam;

    const data = (await samQuery(params)) as {
      totalRecords?: number;
      entityData?: Array<Record<string, unknown>>;
    };

    const entities = data.entityData ?? [];
    return {
      is_excluded: entities.length > 0,
      total_records: data.totalRecords ?? 0,
      exclusions: entities.map(e => ({
        entity: e.entityRegistration ?? e,
        exclusion_details: (e as Record<string, unknown>).exclusionDetails ?? null,
      })),
    };
  },
});

export const sentinelSamEntityRiskSignals = createTool({
  id: 'sentinel-sam-entity-risk-signals',
  description:
    'For a given entity name, retrieve risk-relevant fields from SAM.gov: registration recency, NAICS codes count (business diversification proxy), congressional district, entity structure type, and address details. Useful for building vendor risk profiles. Requires SAM_GOV_API_KEY env var.',
  inputSchema: z.object({
    legal_business_name: z.string().describe('Business name to look up'),
  }),
  execute: async ({ legal_business_name }) => {
    const data = (await samQuery({ legalBusinessName: legal_business_name })) as {
      totalRecords?: number;
      entityData?: Array<Record<string, unknown>>;
    };

    const entities = data.entityData ?? [];
    if (entities.length === 0) {
      return { found: false, legal_business_name, risk_signals: null };
    }

    const riskProfiles = entities.slice(0, 5).map(entity => {
      const reg = (entity.entityRegistration ?? {}) as Record<string, unknown>;
      const core = (entity.coreData ?? {}) as Record<string, unknown>;
      const physAddr = ((core.physicalAddress ?? {}) as Record<string, unknown>);
      const mailingAddr = ((core.mailingAddress ?? {}) as Record<string, unknown>);
      const assertions = (entity.assertions ?? {}) as Record<string, unknown>;

      const registrationDate = reg.registrationDate as string | undefined;
      const registrationAgeDays = registrationDate
        ? Math.floor((Date.now() - new Date(registrationDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const naicsList = ((assertions.naicsCode ?? assertions.goodsAndServices ?? []) as unknown[]);
      const naicsCount = Array.isArray(naicsList) ? naicsList.length : 0;

      return {
        legal_business_name: reg.legalBusinessName ?? legal_business_name,
        uei: reg.ueiSAM,
        registration_status: reg.registrationStatus,
        registration_date: registrationDate,
        registration_age_days: registrationAgeDays,
        entity_structure: reg.entityStructureDesc ?? reg.entityStructure,
        physical_address: physAddr,
        mailing_address: mailingAddr,
        addresses_match:
          physAddr.addressLine1 === mailingAddr.addressLine1 && physAddr.city === mailingAddr.city,
        congressional_district: core.congressionalDistrict,
        naics_count: naicsCount,
        exclusion_status: reg.exclusionStatusFlag,
        active_exclusion: reg.exclusionStatusFlag === 'Y',
      };
    });

    return {
      found: true,
      total_matches: data.totalRecords ?? entities.length,
      risk_signals: riskProfiles,
    };
  },
});
