import type {
  CaseProviderBindings,
  ProviderBinding,
} from "../providers/contracts";
import { bindingsForCase } from "../providers/contracts";

export function bindingsForPersistedCase(case_: {
  externalId: string;
  metadata: Record<string, unknown>;
}): CaseProviderBindings {
  return bindingsForCase(case_);
}
export function bindingForCase(case_: {
  externalId: string;
  metadata: Record<string, unknown>;
}): ProviderBinding {
  return bindingsForPersistedCase(case_).support;
}
