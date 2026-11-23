import type { DocumentStorage } from '../../contracts/providers/document-storage.js';
import { ProviderNotImplementedError } from '../../contracts/shared/provider.js';

export class CustomerDocumentStorage implements DocumentStorage {
  store(input: Parameters<DocumentStorage['store']>[0]): ReturnType<DocumentStorage['store']> {
    void input;
    // TODO: Store document bytes with a customer object-storage put operation.
    // TODO: Return only an opaque DocumentContentReference, never a provider URL or path.
    // TODO: Map rejection, timeout, conflict, and availability errors to the documented domain/provider errors.
    // TODO: Keep raw document PII inside the storage boundary and make the idempotency key authoritative.
    return Promise.reject(this.notImplemented());
  }
  open(input: Parameters<DocumentStorage['open']>[0]): ReturnType<DocumentStorage['open']> {
    void input;
    return Promise.reject(this.notImplemented());
  }
  remove(input: Parameters<DocumentStorage['remove']>[0]): ReturnType<DocumentStorage['remove']> {
    void input;
    return Promise.reject(this.notImplemented());
  }

  private notImplemented(): ProviderNotImplementedError {
    return new ProviderNotImplementedError({
      providerId: 'customer-document-storage',
      operation: 'DOCUMENT_STORAGE',
      safeMessage: 'Customer document storage is not implemented',
    });
  }
}
