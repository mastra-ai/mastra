import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { authorizeDemoSession, readDemoSession } from './provider-connections';

export function DemoProviderAuthorizationForm({ sessionId }: { sessionId: string }) {
  const [session] = useState(() => readDemoSession(sessionId));
  const [code, setCode] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState(false);
  if (!session || session.expiresAt <= Date.now())
    return <Txt role="alert">This sign-in has expired. Start again from onboarding.</Txt>;
  if (authorized) return <Txt role="status">Authorized. Return to the onboarding tab to continue.</Txt>;
  if (session.kind === 'paste-code')
    return (
      <>
        <Txt variant="caption">Copy this code and paste it in the onboarding tab.</Txt>
        <div className="flex items-center gap-4">
          <Txt font="mono" variant="title">
            DEMO
          </Txt>
          <CopyButton content="DEMO" tooltip="Copy demo code" />
        </div>
      </>
    );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault();
        const success = authorizeDemoSession(sessionId, code);
        setAuthorized(success);
        setError(!success);
      }}
    >
      <Input
        aria-label="Device code"
        placeholder="Code from the onboarding tab"
        value={code}
        onChange={event => setCode(event.target.value)}
      />
      {error && <Txt role="alert">Use the code shown in onboarding, or restart if it has expired.</Txt>}
      <Button type="submit" variant="primary" disabled={!code.trim()}>
        Authorize demo connection
      </Button>
    </form>
  );
}
