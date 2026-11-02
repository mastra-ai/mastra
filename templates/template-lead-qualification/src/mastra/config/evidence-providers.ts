import type { EvidenceProvider } from '../providers/evidence';
import { OpenAIEvidenceProvider } from '../providers/open-ai-evidence/provider';

export function evidenceProviders(providers: EvidenceProvider[] = [new OpenAIEvidenceProvider()]) {
  return new Map(providers.map(provider => [provider.id, provider]));
}
