import { Metadata } from 'next';
import React from 'react';

//import RepoSwitcher from '@/components/blocks/repo-switcher';
import Dashboard from '@/components/dashboard';

export const metadata: Metadata = {
  title: 'Github Dashboard',
  description: 'Your Personal Github Dashboard.',
};

type DashboardPageProps = {
  params: {
    repo: string;
  };
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { repo } = params;
  const githubOrg = process.env.GITHUB_ORG || 'kepler-inc';

  return (
    <>
      <Dashboard githubOrg={githubOrg} githubRepo={repo || 'future'} />
    </>
  );
}
