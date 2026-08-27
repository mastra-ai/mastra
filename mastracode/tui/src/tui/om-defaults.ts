import type { OMPack } from '@mastra/code-sdk/onboarding/packs';
import type { TUIState } from './state.js';

/** Reset both live OM roles to dynamic auto selection. */
export async function applyOMModelToSession(state: TUIState, _modelId?: string): Promise<void> {
  await state.session.om.observer.switchModel({ model: 'auto' });
  await state.session.om.reflector.switchModel({ model: 'auto' });
}

/** Provider connection changes reachability; auto roles resolve dynamically and stay unpinned. */
export async function applyProviderOMDefaultIfUnconfigured(
  _state: TUIState,
  _providerId: string,
): Promise<OMPack | undefined> {
  return undefined;
}

// Never rejects: runs after the login success message, and the login .catch would
// report a settings failure as an authentication failure.
export async function seedOMDefaultAfterLogin(
  state: TUIState,
  providerId: string,
  showInfo: (message: string) => void,
): Promise<void> {
  try {
    const pack = await applyProviderOMDefaultIfUnconfigured(state, providerId);
    if (pack) showInfo(`Observational memory - switched to ${pack.modelId}`);
  } catch (error) {
    showInfo(`Observational memory default unchanged: ${error instanceof Error ? error.message : String(error)}`);
  }
}
