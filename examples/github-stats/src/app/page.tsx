import { Metadata } from 'next';
import React from 'react';

//import RepoSwitcher from '@/components/blocks/repo-switcher';
import Dashboard from '@/components/dashboard';

export const metadata: Metadata = {
  title: 'Github Dashboard',
  description: 'Your Personal Github Dashboard.',
};

export default async function DashboardPage() {
  const githubOrg = process.env.GITHUB_ORG || 'kepler-inc';
  const repos = (process.env.GITHUB_REPOS || '').split(',') || ['future'];

  return (
    <>
      <div className="hidden flex-col md:flex">
        <div className="border-b">
          {/* <div className="flex h-16 items-center px-4">
            <RepoSwitcher repos={repos} setRepo={setGithubRepo} />
          </div> */}
        </div>
        <Dashboard githubOrg={githubOrg} githubRepo={repos[0] || 'future'} />
      </div>
    </>
  );
}
