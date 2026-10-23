import type { MultimodalDocumentExtractionProvider } from '../../contracts/providers/document-extraction.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerDocumentExtractionProvider implements MultimodalDocumentExtractionProvider {
  readonly id = 'customer-document-extraction';
  readonly capabilities: ProviderCapabilities = {
    operations: ['DOCUMENT_EXTRACTION'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['DOCUMENT_CONTENT', 'DOCUMENT_METADATA'],
    documentMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    jurisdictions: ['US'],
  };

  extract(
    input: Parameters<MultimodalDocumentExtractionProvider['extract']>[0],
    context: Parameters<MultimodalDocumentExtractionProvider['extract']>[1],
  ): ReturnType<MultimodalDocumentExtractionProvider['extract']> {
    void input;
    void context;
    // TODO: Call one structured multimodal extraction operation for the referenced document.
    // TODO: Map the response to DocumentExtractionResult and validate it before returning.
    // TODO: Translate rate limits, timeouts, invalid output, rejection, and unavailability to ProviderError.
    // TODO: Send only required document PII, honor the deadline, and reuse the supplied idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'DOCUMENT_EXTRACTION',
        safeMessage: 'Customer document extraction is not implemented',
      }),
    );
  }
}
