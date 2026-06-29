import type { Dispatch, SetStateAction } from 'react';
import { createContext, use } from 'react';
import type { CrumbDef } from './types';

export interface CrumbsOverrideState {
  override: CrumbDef[] | null;
  setOverride: Dispatch<SetStateAction<CrumbDef[] | null>>;
}

export const CrumbsOverrideContext = createContext<CrumbsOverrideState | null>(null);

export function useRouteHeaderCrumbsOverride(): CrumbDef[] | null {
  const ctx = use(CrumbsOverrideContext);
  return ctx?.override ?? null;
}

export function useRouteHeaderCrumbsSetter(): Dispatch<SetStateAction<CrumbDef[] | null>> | undefined {
  return use(CrumbsOverrideContext)?.setOverride;
}
