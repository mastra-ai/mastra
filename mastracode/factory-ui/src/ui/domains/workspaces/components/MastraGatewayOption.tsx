import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { MastraGatewayBilling } from './MastraGatewayBilling';
import { ProviderBrandIcon } from './ProviderBrandIcon';

/** The recommended way to run a Factory: one click connects the organization's Mastra Gateway. */
export function MastraGatewayOption({
  provider,
  disabled,
  connecting,
  onConnect,
  onPreview,
}: {
  provider: string;
  disabled: boolean;
  connecting: boolean;
  onConnect: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="pt-0.5">
          <ProviderBrandIcon provider={provider} />
        </span>
        <div className="min-w-0 flex-1">
          <Txt as="h2" variant="caption" tone="ink" className="m-0 flex items-center gap-2">
            {providerDisplayName(provider)}
            <Badge size="xs" variant="success" emphasis="subtle">
              Recommended
            </Badge>
          </Txt>
          <Txt variant="caption" tone="muted" className="mt-1">
            <MastraGatewayBilling />
          </Txt>
        </div>
      </div>
      <Button
        variant="primary"
        className="w-full"
        disabled={disabled}
        onMouseEnter={onPreview}
        onFocus={onPreview}
        onClick={() => {
          onConnect();
          onPreview();
        }}
      >
        {connecting ? 'Connecting…' : 'Connect Mastra Gateway'}
      </Button>
    </div>
  );
}
