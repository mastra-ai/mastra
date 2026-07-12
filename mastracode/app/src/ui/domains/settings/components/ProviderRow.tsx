import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';
import type { ProviderInfo, StartProviderOAuthResponse } from '#shared/api/types';

const SOURCE_LABEL: Record<ProviderInfo['source'], string> = {
  oauth: 'Signed in',
  stored: 'Key saved',
  env: 'From env',
  none: 'Not set',
};

const SOURCE_VARIANT: Record<ProviderInfo['source'], 'success' | 'info' | 'default'> = {
  oauth: 'success',
  stored: 'success',
  env: 'info',
  none: 'default',
};

interface ProviderRowProps {
  provider: ProviderInfo;
  credentialManagementEnabled: boolean;
  busy: boolean;
  onSaveKey: (key: string, envVar?: string) => Promise<boolean>;
  onRemoveKey: () => Promise<void>;
  onStartOAuth: () => Promise<StartProviderOAuthResponse | undefined>;
  onCompleteOAuth: (loginId: string, code: string) => Promise<boolean>;
  onRemoveOAuth: () => Promise<void>;
}

export function ProviderRow({
  provider,
  credentialManagementEnabled,
  busy,
  onSaveKey,
  onRemoveKey,
  onStartOAuth,
  onCompleteOAuth,
  onRemoveOAuth,
}: ProviderRowProps) {
  const [editing, setEditing] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [oauthPrompt, setOAuthPrompt] = useState<{
    loginId: string;
    code: string;
    completionMode: StartProviderOAuthResponse['completionMode'];
    instructions?: string;
  }>();

  const cancelKeyEdit = () => {
    setEditing(false);
    setKeyDraft('');
  };

  const saveKey = async () => {
    const key = keyDraft.trim();
    if (key && (await onSaveKey(key, provider.envVar))) cancelKeyEdit();
  };

  const startOAuth = async () => {
    const login = await onStartOAuth();
    if (!login) return;
    window.open(login.authUrl, '_blank', 'noopener,noreferrer');
    cancelKeyEdit();
    setOAuthPrompt({
      loginId: login.loginId,
      code: '',
      completionMode: login.completionMode,
      ...(login.instructions ? { instructions: login.instructions } : {}),
    });
  };

  const completeOAuth = async () => {
    const code = oauthPrompt?.code.trim();
    if (!oauthPrompt || (oauthPrompt.completionMode === 'manual-code' && !code)) return;
    if (await onCompleteOAuth(oauthPrompt.loginId, code ?? '')) setOAuthPrompt(undefined);
  };

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {provider.source !== 'none' && <Check size={13} className="text-accent1 shrink-0" />}
          <Txt as="span" variant="ui-md" className="truncate text-icon6">
            {provider.displayName ?? provider.provider}
          </Txt>
          {provider.displayName && (
            <Txt as="span" variant="ui-xs" className="hidden truncate text-icon3 sm:inline">
              {provider.provider}
            </Txt>
          )}
          <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
            {SOURCE_LABEL[provider.source]}
          </Badge>
        </div>

        {credentialManagementEnabled &&
          (editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                type="password"
                size="sm"
                placeholder="Paste API key"
                value={keyDraft}
                onChange={event => setKeyDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void saveKey();
                  if (event.key === 'Escape') cancelKeyEdit();
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busy || !keyDraft.trim()}
                onClick={() => void saveKey()}
              >
                Save
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={cancelKeyEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {provider.oauthSupported && provider.source !== 'oauth' && (
                <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void startOAuth()}>
                  <LogIn size={14} />
                  <span>Sign in</span>
                </Button>
              )}
              {provider.source === 'oauth' && (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onRemoveOAuth()}>
                  <LogOut size={14} />
                  <span>Sign out</span>
                </Button>
              )}
              {provider.source !== 'oauth' && (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEditing(true);
                    setKeyDraft('');
                    setOAuthPrompt(undefined);
                  }}
                >
                  {provider.source === 'stored' ? 'Update' : 'Add key'}
                </Button>
              )}
              {provider.source === 'stored' && (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onRemoveKey()}>
                  Remove
                </Button>
              )}
            </div>
          ))}
      </div>

      {credentialManagementEnabled && oauthPrompt && (
        <div className="flex flex-col gap-2 pl-5">
          {oauthPrompt.completionMode === 'browser-callback' && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {oauthPrompt.instructions ?? 'Complete sign-in in your browser, then check the connection.'}
            </Txt>
          )}
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              type="password"
              size="sm"
              placeholder={
                oauthPrompt.completionMode === 'browser-callback'
                  ? 'Paste a code only if the browser callback fails'
                  : `Paste ${provider.displayName ?? provider.provider} code`
              }
              value={oauthPrompt.code}
              onChange={event => setOAuthPrompt({ ...oauthPrompt, code: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter') void completeOAuth();
                if (event.key === 'Escape') setOAuthPrompt(undefined);
              }}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || (oauthPrompt.completionMode === 'manual-code' && !oauthPrompt.code.trim())}
              onClick={() => void completeOAuth()}
            >
              {oauthPrompt.completionMode === 'browser-callback' && !oauthPrompt.code.trim()
                ? 'Check sign-in'
                : 'Complete'}
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => setOAuthPrompt(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
