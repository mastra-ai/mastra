import type { ReactNode } from 'react';

import { SettingsSubsection } from '../preferences/settings-subsection';

import { DefaultsCard } from './defaults-card';
import type { FactoryModelScope, ModelDefaults } from './model-routes';
import { ModelRoutingSkeleton } from './model-routing-skeleton';
import { ModelRoutingSwitch } from './model-routing-switch';
import { Txt } from '@/ds/components/Txt';

export interface ModelDefaultsSlots {
  packs: ReactNode;
  providers: ReactNode;
}

export interface ModelRoutingViewProps {
  /** Undefined while the Factory's routing loads. */
  scope: FactoryModelScope | undefined;
  loading: boolean;
  pending?: boolean;
  error?: string;
  /** Omit to show the routing without letting anyone switch it. */
  onPickScope?: (scope: FactoryModelScope) => void;
  personal: ModelDefaultsSlots;
  factory: ModelDefaultsSlots;
  /** Which card the page was linked to, so it opens expanded. */
  openedDefaults?: ModelDefaults;
  /** Shown under each card's packs skeleton while loading. */
  providersSkeleton?: ReactNode;
  /** Rendered after the cards, e.g. a confirm dialog for a routing change. */
  children?: ReactNode;
}

export function ModelRoutingView({
  scope,
  loading,
  pending = false,
  error,
  onPickScope,
  personal,
  factory,
  openedDefaults,
  providersSkeleton,
  children,
}: ModelRoutingViewProps) {
  return (
    <SettingsSubsection
      scope="factory"
      title="Model routing"
      description="Which defaults chats and work-item runs use. Running threads keep the model they already picked."
      action={
        scope && (
          <ModelRoutingSwitch
            value={scope}
            pending={pending}
            disabled={!onPickScope}
            onValueChange={next => onPickScope?.(next)}
          />
        )
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {error}
          </Txt>
        )}
        {loading && <ModelRoutingSkeleton providers={providersSkeleton} />}
        {scope && (
          <div className="flex flex-col gap-3">
            <DefaultsCard
              defaults="personal"
              scope={scope}
              packs={personal.packs}
              providers={personal.providers}
              openedByLink={openedDefaults === 'personal'}
            />
            <DefaultsCard
              defaults="factory"
              scope={scope}
              packs={factory.packs}
              providers={factory.providers}
              openedByLink={openedDefaults === 'factory'}
            />
          </div>
        )}
        {children}
      </div>
    </SettingsSubsection>
  );
}
