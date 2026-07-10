import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { LogIn, Settings, SlidersHorizontal } from 'lucide-react';

import type { OverlayName } from '../../../lib/overlays';
import { useOverlays } from '../../../lib/overlays';

type ErrorResolution = {
  title: string;
  guidance: string;
  actions: Array<{
    label: string;
    overlay: OverlayName;
    icon: typeof Settings;
  }>;
};

const credentialError =
  /security token|credentials?|api[\s_-]?key|unauthori[sz]ed|forbidden|not logged in|authentication|authorization|oauth|access token|refresh token|invalid token|expired token/i;
const limitError = /rate limit|quota|usage limit|capacity|overloaded|too many requests|credits? exhausted/i;
const modelError = /model.*(?:invalid|missing|not found|not available|unavailable|unsupported)|no model|select a model/i;

function cleanErrorMessage(message: string): string {
  const cleaned = message.trim().replace(/^(?:undefined|null)(?::\s*|\s+)/i, '');
  return cleaned || 'The request failed without an error message.';
}

function resolutionFor(message: string): ErrorResolution {
  if (credentialError.test(message)) {
    return {
      title: 'Credentials need attention',
      guidance: 'Check the selected model credentials, or switch to another available model.',
      actions: [
        { label: 'Choose model', overlay: 'model-settings', icon: SlidersHorizontal },
        { label: 'Sign in', overlay: 'provider-settings', icon: LogIn },
      ],
    };
  }

  if (limitError.test(message)) {
    return {
      title: 'Provider limit reached',
      guidance: 'Choose another available model, or retry after the provider limit resets.',
      actions: [{ label: 'Choose model', overlay: 'model-settings', icon: SlidersHorizontal }],
    };
  }

  if (modelError.test(message)) {
    return {
      title: 'Model unavailable',
      guidance: 'Choose a model that is available for the current account.',
      actions: [{ label: 'Choose model', overlay: 'model-settings', icon: SlidersHorizontal }],
    };
  }

  return {
    title: 'Request failed',
    guidance: 'Review the current settings, then retry the request.',
    actions: [{ label: 'Review settings', overlay: 'settings', icon: Settings }],
  };
}

export function ErrorNotice({ message }: { message: string }) {
  const overlays = useOverlays();
  const errorMessage = cleanErrorMessage(message);
  const resolution = resolutionFor(errorMessage);

  return (
    <Notice variant="destructive" title={resolution.title}>
      <Notice.Message className="break-words">{errorMessage}</Notice.Message>
      <Notice.Message className="mt-2">{resolution.guidance}</Notice.Message>
      <div className="mt-3 flex flex-wrap gap-2">
        {resolution.actions.map(({ label, overlay, icon: Icon }, index) => (
          <Button
            key={overlay}
            type="button"
            variant={index === 0 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => overlays.open(overlay)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </Notice>
  );
}
