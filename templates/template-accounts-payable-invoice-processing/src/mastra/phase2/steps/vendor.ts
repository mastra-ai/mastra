import type { Phase2Runtime } from '../composition.ts';
import { runtimeSources } from '../composition.ts';
import { ProviderUnavailableError } from '../ports.ts';
import { AssessmentStateSchema, type AssessmentState, type Phase2Invoice, type StepDecision } from '../schemas.ts';
import { confidenceProblems } from '../confidence.ts';

const initial = (invoice: Phase2Invoice): AssessmentState => ({
  invoice,
  vendor: null,
  purchaseOrder: null,
  receipts: [],
  decisions: [],
  matchMode: null,
  duplicateIds: [],
});
const unavailable = (error: ProviderUnavailableError, sources: Record<string, string>): StepDecision => ({
  step: 'vendor',
  outcome: 'unknown_retry',
  reviewType: null,
  reasons: [{ code: 'VENDOR_LOOKUP_UNAVAILABLE', message: error.message }],
  signals: [],
  adaptations: [],
  sources,
});
const identity = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
export function makeVendorValidation(runtime: Phase2Runtime) {
  const provider = runtime.provider,
    sources = runtimeSources(runtime);
  return async (invoice: Phase2Invoice) => {
    const state = initial(invoice),
      adaptations: StepDecision['adaptations'] = [],
      signals: string[] = [];
    const policy = await runtime.policy.getPolicy();
    const { uncertainFields, missingConfidence } = confidenceProblems(invoice, policy.lowConfidenceThreshold);
    if (
      invoice.overallConfidence < policy.lowConfidenceThreshold ||
      uncertainFields.length ||
      missingConfidence.length
    ) {
      state.decisions.push({
        step: 'extraction',
        outcome: 'verify_extraction',
        reviewType: 'verify_extraction',
        reasons: [
          {
            code: 'LOW_EXTRACTION_CONFIDENCE',
            message: 'Document extraction requires human verification before financial controls run',
            evidence: {
              overallConfidence: invoice.overallConfidence,
              uncertainFields,
              missingConfidence,
            },
          },
        ],
        signals: ['low_extraction_confidence'],
        adaptations,
        sources: {},
      });
      return AssessmentStateSchema.parse(state);
    }
    if (!provider.capabilities.vendorBankDetails) {
      adaptations.push({ code: 'VENDOR_BANK_DETAILS_UNAVAILABLE', providerId: sources.vendors });
      signals.push('payment_details_unverifiable');
    }
    if (provider.capabilities.vendorStatusRichness === 'binary')
      adaptations.push({ code: 'VENDOR_STATUS_BINARY', providerId: sources.vendors });
    if (runtime.sanctionsIsFallback)
      adaptations.push({ code: 'SANCTIONS_SOURCE_FALLBACK', providerId: sources.sanctions });
    try {
      const vendors = await provider.vendors!.find({
        name: invoice.vendorName,
        taxId: invoice.vendorTaxId,
      });
      if (vendors.length !== 1) {
        state.decisions.push({
          step: 'vendor',
          outcome: 'review',
          reviewType: vendors.length ? 'ambiguous_vendor' : 'unknown_vendor',
          reasons: [
            {
              code: vendors.length ? 'VENDOR_AMBIGUOUS' : 'VENDOR_NOT_FOUND',
              message: vendors.length
                ? 'Multiple vendors match the printed identity'
                : 'No vendor matches the printed identity',
            },
          ],
          signals,
          adaptations,
          sources: { vendors: sources.vendors },
        });
        return AssessmentStateSchema.parse(state);
      }
      const vendor = vendors[0]!,
        restriction =
          provider.capabilities.vendorStatusRichness === 'binary'
            ? await runtime.statusRestrictions?.getRestriction({
                providerId: sources.vendors,
                vendorId: vendor.id,
              })
            : null;
      state.vendor = restriction ? { ...vendor, status: restriction } : vendor;
      const taxIdMismatch =
        invoice.vendorTaxId && vendor.taxId && identity(invoice.vendorTaxId) !== identity(vendor.taxId);
      const mismatchReason = taxIdMismatch
        ? {
            code: 'VENDOR_TAX_ID_MISMATCH',
            message: 'Printed and canonical vendor tax IDs conflict',
            evidence: { printed: invoice.vendorTaxId, canonical: vendor.taxId },
          }
        : null;
      if (invoice.vendorTaxId && !vendor.taxId) signals.push('vendor_tax_id_unverifiable');
      if (state.vendor.status !== 'approved') {
        state.decisions.push({
          step: 'vendor',
          outcome: 'blocked',
          reviewType: null,
          reasons: [
            {
              code: 'VENDOR_NOT_APPROVED',
              message: `Vendor status is ${state.vendor.status}`,
              evidence: { status: state.vendor.status },
            },
            ...(mismatchReason ? [mismatchReason] : []),
          ],
          signals,
          adaptations,
          sources: { vendors: sources.vendors },
        });
        return AssessmentStateSchema.parse(state);
      }
      const sanctions = await runtime.sanctions.screen(state.vendor);
      if (sanctions.matched) {
        state.decisions.push({
          step: 'vendor',
          outcome: 'blocked',
          reviewType: null,
          reasons: [
            {
              code: 'SANCTIONS_MATCH',
              message: 'Vendor matched a sanctions list',
              evidence: sanctions,
            },
            ...(mismatchReason ? [mismatchReason] : []),
          ],
          signals,
          adaptations,
          sources: { vendors: sources.vendors, sanctions: sources.sanctions },
        });
        return AssessmentStateSchema.parse(state);
      }
      if (mismatchReason) {
        const uncertain = invoice.confidence.some(
          item => item.field === 'vendorTaxId' && item.confidence < policy.lowConfidenceThreshold,
        );
        state.decisions.push({
          step: 'vendor',
          outcome: uncertain ? 'verify_extraction' : 'review',
          reviewType: uncertain ? null : 'vendor_identity_mismatch',
          reasons: [mismatchReason],
          signals,
          adaptations,
          sources: { vendors: sources.vendors, sanctions: sources.sanctions },
        });
        return AssessmentStateSchema.parse(state);
      }
      state.decisions.push({
        step: 'vendor',
        outcome: 'pass',
        reviewType: null,
        reasons: [
          {
            code: 'VENDOR_VALID',
            message: 'Vendor identity and status are valid',
            evidence: { vendorId: state.vendor.id },
          },
        ],
        signals,
        adaptations,
        sources: { vendors: sources.vendors, sanctions: sources.sanctions },
      });
      return AssessmentStateSchema.parse(state);
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      state.decisions.push(unavailable(error, { vendors: sources.vendors }));
      return AssessmentStateSchema.parse(state);
    }
  };
}
