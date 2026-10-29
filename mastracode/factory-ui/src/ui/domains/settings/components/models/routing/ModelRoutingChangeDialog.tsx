import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { OnboardingAccountsPreview } from '../../../../workspaces/components/onboarding/preview/OnboardingAccountsPreview';
import { OnboardingIllustration } from '../../../../workspaces/components/onboarding/preview/OnboardingIllustration';
import { ACCOUNT_MODES } from '../../../../workspaces/components/onboarding/preview/OnboardingPreview';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { SETUP_DETAILS, SETUP_LABELS } from '../../../../workspaces/services/onboardingSteps';
import {
  MODEL_DEFAULTS_LABELS,
  MODEL_LANES,
  MODEL_LANE_LABELS,
  MODEL_ROUTES,
  MODEL_SCOPE_LABELS,
} from './model-routes';

// Lets the dialog settle before the sketch morphs, so the change reads as before → after.
const MORPH_DELAY_MS = 320;

export function ModelRoutingChangeDialog({
  from,
  to,
  onConfirm,
  onCancel,
}: {
  from: FactoryModelScope;
  to: FactoryModelScope | undefined;
  onConfirm: (scope: FactoryModelScope) => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={to !== undefined} onOpenChange={open => !open && onCancel()}>
      {to && (
        <AlertDialog.Content size="md">
          <AlertDialog.Header>
            <AlertDialog.Title>Switch model routing to {MODEL_SCOPE_LABELS[to]}?</AlertDialog.Title>
            <AlertDialog.Description>
              This changes the accounts and models everyone in this Factory uses, not just you.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <div className="flex flex-col gap-5">
              <RoutingSketch from={from} to={to} />
              <div>
                <Txt as="p" variant="caption">
                  {SETUP_LABELS[to]}
                </Txt>
                <Txt as="p" variant="meta" tone="muted" className="mt-1">
                  {SETUP_DETAILS[to]}
                </Txt>
              </div>
              <ul aria-label="What changes" className="flex flex-col gap-2">
                {MODEL_LANES.filter(lane => MODEL_ROUTES[from][lane] !== MODEL_ROUTES[to][lane]).map(lane => (
                  <li key={lane} className="flex flex-wrap items-center gap-x-2">
                    <Txt as="span" variant="meta">
                      {MODEL_LANE_LABELS[lane]}:
                    </Txt>
                    <Txt as="span" variant="meta" tone="muted">
                      {MODEL_DEFAULTS_LABELS[MODEL_ROUTES[from][lane]]}
                    </Txt>
                    <ArrowRight aria-label="to" className="text-muted-foreground size-3" />
                    <Txt as="span" variant="meta">
                      {MODEL_DEFAULTS_LABELS[MODEL_ROUTES[to][lane]]}
                    </Txt>
                  </li>
                ))}
              </ul>
              <Txt as="p" variant="meta" tone="muted">
                New chats and work-item runs pick this up right away. Running threads keep the model they already
                picked.
              </Txt>
            </div>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={() => onConfirm(to)}>Switch for everyone</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      )}
    </AlertDialog>
  );
}

/** The onboarding accounts sketch, starting on the current routing and morphing to the requested one. */
function RoutingSketch({ from, to }: { from: FactoryModelScope; to: FactoryModelScope }) {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const timer = setTimeout(() => setShown(to), MORPH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [to]);
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-[5/4] w-full max-w-sm">
      <OnboardingIllustration scene="accounts" mode={ACCOUNT_MODES[shown]} />
      <OnboardingAccountsPreview step="model-setup" modelScope={shown} />
    </div>
  );
}
