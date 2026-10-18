import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
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
    <div className="space-y-4 rounded border p-4">
      <Field invalid={Boolean(providersError)} disabled={providersLoading}>
        <FieldLabel>Provider</FieldLabel>
        <Select value={providerId} onValueChange={onProviderChange}>
          <SelectTrigger>
            <SelectValue placeholder={providersLoading ? 'Loading providers…' : 'Select provider'} />
          </SelectTrigger>
          <SelectContent>
            {providers.map(provider => (
              <SelectItem key={provider.id} value={provider.id}>
                {`${provider.displayName ?? provider.name} (${provider.id})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{providersError ? String(providersError) : undefined}</FieldError>
      </Field>

      <Field invalid={Boolean(toolkitsError)} disabled={!providerId || toolkitsLoading}>
        <FieldLabel>Toolkit</FieldLabel>
        <Select value={toolkit} onValueChange={onToolkitChange}>
          <SelectTrigger>
            <SelectValue placeholder={toolkitsLoading ? 'Loading toolkits…' : 'Select toolkit'} />
          </SelectTrigger>
          <SelectContent>
            {toolkits.map(item => (
              <SelectItem key={item.slug} value={item.slug}>
                {`${item.name} (${item.slug})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{toolkitsError ? String(toolkitsError) : undefined}</FieldError>
      </Field>

      <Field disabled={!providerId || !toolkit}>
        <FieldLabel>Label (optional)</FieldLabel>
        <Input placeholder="My personal Gmail" value={label} onChange={event => onLabelChange(event.target.value)} />
      </Field>

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
