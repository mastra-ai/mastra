import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyStateIllustration } from '@mastra/playground-ui/components/EmptyState';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { useSearchParams } from 'react-router';

import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { OnboardingAccountMenu } from '../workspaces/components/onboarding/OnboardingAccountMenu';
import { OnboardingInset } from '../workspaces/components/onboarding/OnboardingInset';

/**
 * `/join?factory=…` for someone signed in who isn't in the Factory's organization. Replaces both dead ends
 * a non-member hits today: Platform's "Access denied" notice on the sign-in page, and (WorkOS/Better Auth) the
 * create-a-factory onboarding their auto-created personal org sends them to. Request access files a join
 * request with the org's admins (Platform `/v1/org/join-requests`); the Slack card updates when it's approved.
 */
export function NotAMemberPage() {
  const [params] = useSearchParams();
  const auth = useFactoryAuth();
  const factory = params.get('factory') ?? 'the-factory';
  const org = params.get('org') ?? 'Kepler';
  const agent = params.get('agent');
  const requested = params.get('state') === 'requested';
  const email = auth.data?.user?.email ?? 'alex@contractor.dev';

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <LogoWithoutText className="w-6" aria-hidden="true" />
          <Txt as="span" variant="label">
            Factory
          </Txt>
        </div>
        <OnboardingAccountMenu />
      </header>
      <main className="grid flex-1 place-items-center px-6 pb-[12vh]">
        <div className="group/empty-state flex w-full max-w-md flex-col items-center text-center">
          <EmptyStateIllustration name="not-a-member" />
          <Txt as="h1" variant="title">
            {requested ? 'Request sent' : `You're not in ${org}'s Factory yet`}
          </Txt>
          <Txt as="p" variant="body" tone="muted" className="mt-2">
            {requested
              ? `We let ${org}'s admins know. You'll get a Slack message${agent ? ` from @${agent}` : ''} as soon as one approves, and your message will run then.`
              : `${agent ? `@${agent} runs in ${factory}, ` : `${factory} belongs to `}${org}'s Mastra organization. You're signed in as ${email}, which isn't a member.`}
          </Txt>

          {agent && (
            <OnboardingInset className="bg-card mt-6 w-full flex-row items-center gap-3 p-3 text-start">
              <SlackIcon className="size-icon-sm shrink-0" aria-hidden="true" />
              <Txt as="span" variant="caption" tone="muted" className="min-w-0 flex-1 truncate">
                Your message to @{agent} in #eng-factory is saved
              </Txt>
              {requested && <IconCheckmark2Medium className="text-success-indicator size-icon-sm shrink-0" />}
            </OnboardingInset>
          )}

          <div className="mt-6 flex w-full flex-col gap-2">
            {requested ? (
              <Button size="lg" className="w-full" variant="ghost">
                Cancel request
              </Button>
            ) : (
              <>
                <Button variant="primary" size="lg" className="w-full">
                  Request access
                </Button>
                <Button size="lg" className="w-full" variant="ghost">
                  Use a different account
                </Button>
              </>
            )}
          </div>
          <Txt as="p" variant="meta" tone="muted" className="mt-6">
            {requested
              ? 'Admins approve requests in Platform › Members, or right from the Slack notification.'
              : `Already invited? Open the invite email from ${org} and sign in with that address.`}
          </Txt>
        </div>
      </main>
    </div>
  );
}
