/**
 * BDD coverage for the "which GitHub org do I pick?" guidance.
 *
 * GitHub's App install screen asks which account to install into. Choosing a
 * personal account when the repos live in an organization yields an empty repo
 * list with no explanation, so every connect/manage surface states the rule and
 * names the accounts already installed. These tests drive the real
 * `/web/github/status` + `/web/github/repos` transport through MSW.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { Command, CommandList } from '@mastra/playground-ui/components/Command';
import { ConnectRepositoriesPanel } from '../ConnectRepositoriesPanel';
import { CreateFactoryRepositoryRows } from '../create-factory/CreateFactoryRepositoryRows';
import { GITHUB_ORG_CHOICE_HINT, GITHUB_ORG_CHOICE_HINT_SHORT } from '../githubConnectionCopy';
import { VcsFactoryStep } from '../VcsFactoryStep';
import type { FactoryProject, GithubStatus } from '../../services/github';

const FACTORY: FactoryProject = { id: 'fp-1', name: 'Acme', repositories: [] };

function stubGithub(status: Partial<GithubStatus>, repos: unknown[] = []) {
  server.use(
    http.get('*/web/github/status', () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [], ...status }),
    ),
    http.get('*/web/github/repos', () => HttpResponse.json({ repos })),
  );
}

function renderVcsStep() {
  renderWithProviders(
    <VcsFactoryStep
      connectingRepositoryId={null}
      githubRedirecting={false}
      mutationPending={false}
      mutationError={null}
      onConnect={() => {}}
      onManageConnection={() => {}}
      onSelectRepository={() => {}}
    />,
  );
}

function renderPaletteRows() {
  renderWithProviders(
    <Command>
      <CommandList>
        <CreateFactoryRepositoryRows
          query=""
          githubRedirecting={false}
          onConnect={() => {}}
          onManageConnection={() => {}}
          onSelectRepository={() => {}}
        />
      </CommandList>
    </Command>,
  );
}

describe('GitHub organization guidance', () => {
  it('given GitHub is not connected yet, when the wizard VCS step renders, then it says which organization to install into', async () => {
    stubGithub({ connected: false, reason: 'not_connected' });

    renderVcsStep();

    expect(await screen.findByText(GITHUB_ORG_CHOICE_HINT)).toBeInTheDocument();
  });

  it('given GitHub is not connected yet, when the repositories panel renders, then it says which organization to install into', async () => {
    stubGithub({ connected: false, reason: 'not_connected' });

    renderWithProviders(<ConnectRepositoriesPanel factory={FACTORY} />);

    expect(await screen.findByText(GITHUB_ORG_CHOICE_HINT)).toBeInTheDocument();
  });

  it('given an installation exists but reaches no repositories, when the panel renders, then it names the installed org and repeats the guidance', async () => {
    stubGithub({
      connected: true,
      reason: 'ready',
      installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
    });

    renderWithProviders(<ConnectRepositoriesPanel factory={FACTORY} />);

    expect(await screen.findByText('Installed on: mastra-ai')).toBeInTheDocument();
    expect(await screen.findByText(GITHUB_ORG_CHOICE_HINT)).toBeInTheDocument();
  });

  it('given GitHub is not connected yet, when the create-factory palette renders, then the Connect row states which organization to install into', async () => {
    stubGithub({ connected: false, reason: 'not_connected' });

    renderPaletteRows();

    expect(await screen.findByText(GITHUB_ORG_CHOICE_HINT_SHORT)).toBeInTheDocument();
  });

  it('given an installation exists, when the create-factory palette renders, then the manage row names the installed org', async () => {
    stubGithub({
      connected: true,
      reason: 'ready',
      installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
    });

    renderPaletteRows();

    expect(await screen.findByText('Installed on: mastra-ai')).toBeInTheDocument();
  });

  it('given the account has no WorkOS organization, when the wizard VCS step renders, then only the WorkOS message shows and the GitHub-org guidance stays hidden', async () => {
    stubGithub({ connected: false, reason: 'organization_required', organizationRequired: true });

    renderVcsStep();

    expect(await screen.findByText('Join an organization to connect GitHub repositories.')).toBeInTheDocument();
    expect(screen.queryByText(GITHUB_ORG_CHOICE_HINT)).not.toBeInTheDocument();
  });
});
