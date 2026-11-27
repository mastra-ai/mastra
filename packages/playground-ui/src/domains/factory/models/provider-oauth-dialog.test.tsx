// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderOAuthDialog } from './provider-oauth-dialog';
import type { OAuthStartResponse, ProviderOAuthActions } from './provider-oauth-dialog';
import { renderWithProviders } from '@/test/render';

const pasteCodeSession: OAuthStartResponse = {
  sessionId: 'session-1',
  kind: 'paste-code',
  url: 'https://claude.ai/oauth/authorize',
  instructions: 'Copy the code shown after you approve.',
  expiresAt: Date.now() + 600_000,
};

function openDialog(session: OAuthStartResponse, actions: Partial<ProviderOAuthActions>) {
  const onComplete = vi.fn();
  renderWithProviders(
    <ProviderOAuthDialog
      provider="anthropic"
      session={session}
      actions={{ complete: vi.fn(), poll: vi.fn(), ...actions }}
      onClose={() => {}}
      onComplete={onComplete}
    />,
  );
  return onComplete;
}

function pasteCode(code: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Authorization code' }), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete sign in' }));
}

describe('ProviderOAuthDialog', () => {
  it("given a pasted code, sends it through the host's complete action and then completes", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const onComplete = openDialog(pasteCodeSession, { complete });

    pasteCode('  code-123  ');

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(complete).toHaveBeenCalledWith(
      { provider: 'anthropic', sessionId: 'session-1', code: 'code-123' },
      expect.anything(),
    );
  });

  it("given the host's complete action fails, shows its error and stays open", async () => {
    const onComplete = openDialog(pasteCodeSession, {
      complete: vi.fn().mockRejectedValue(new Error('That code has expired.')),
    });

    pasteCode('code-123');

    expect((await screen.findByRole('alert')).textContent).toBe('That code has expired.');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("given a device-code sign-in, polls through the host's poll action until it completes", async () => {
    const poll = vi.fn().mockResolvedValue({ status: 'complete' });
    const onComplete = openDialog(
      { ...pasteCodeSession, kind: 'device-code', userCode: 'ABCD-1234', nextPollMs: 0 },
      { poll },
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(poll).toHaveBeenCalledWith({ provider: 'anthropic', sessionId: 'session-1' }, expect.anything());
  });
});
