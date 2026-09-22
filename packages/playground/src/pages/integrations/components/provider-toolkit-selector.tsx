import { Button } from '@mastra/playground-ui/components/Button';
import { SelectFieldBlock, TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ProviderItem, ToolkitItem } from '../types';

interface ProviderToolkitSelectorProps {
  providers: ProviderItem[];
  toolkits: ToolkitItem[];
  providerId: string;
  toolkit: string;
  label: string;
  providersLoading: boolean;
  providersError: unknown;
  toolkitsLoading: boolean;
  toolkitsError: unknown;
  authorizePending: boolean;
  authorizeError: unknown;
  authorizedConnection?: { connectionId: string; status: string };
  onProviderChange: (providerId: string) => void;
  onToolkitChange: (toolkit: string) => void;
  onLabelChange: (label: string) => void;
  onConnect: () => void;
}

export function ProviderToolkitSelector({
  providers,
  toolkits,
  providerId,
  toolkit,
  label,
  providersLoading,
  providersError,
  toolkitsLoading,
  toolkitsError,
  authorizePending,
  authorizeError,
  authorizedConnection,
  onProviderChange,
  onToolkitChange,
  onLabelChange,
  onConnect,
}: ProviderToolkitSelectorProps) {
  return (
    <div className="space-y-4 border rounded p-4">
      <SelectFieldBlock
        name="provider"
        label="Provider"
        value={providerId}
        onValueChange={onProviderChange}
        disabled={providersLoading}
        placeholder={providersLoading ? 'Loading providers…' : 'Select provider'}
        options={providers.map(provider => ({
          value: provider.id,
          label: `${provider.displayName ?? provider.name} (${provider.id})`,
        }))}
        errorMsg={providersError ? String(providersError) : undefined}
      />

      <SelectFieldBlock
        name="toolkit"
        label="Toolkit"
        value={toolkit}
        onValueChange={onToolkitChange}
        disabled={!providerId || toolkitsLoading}
        placeholder={toolkitsLoading ? 'Loading toolkits…' : 'Select toolkit'}
        options={toolkits.map(item => ({ value: item.slug, label: `${item.name} (${item.slug})` }))}
        errorMsg={toolkitsError ? String(toolkitsError) : undefined}
      />

      <TextFieldBlock
        name="connection-label"
        label="Label (optional)"
        placeholder="My personal Gmail"
        value={label}
        onChange={event => onLabelChange(event.target.value)}
        disabled={!providerId || !toolkit}
      />

      <Button
        type="button"
        variant="primary"
        onClick={onConnect}
        disabled={!providerId || !toolkit || authorizePending}
      >
        {authorizePending ? 'Authorizing…' : 'Connect'}
      </Button>

      {authorizeError ? (
        <div role="alert">
          <Notice variant="destructive">{String(authorizeError)}</Notice>
        </div>
      ) : null}
      {authorizedConnection ? (
        <Notice variant="success">
          Authorized: {authorizedConnection.connectionId} (status: {authorizedConnection.status})
        </Notice>
      ) : null}
    </div>
  );
}
