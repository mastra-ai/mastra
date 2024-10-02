import { Framework } from '@mastra/core';
import React from 'react';

import { HorizontalChart } from '@/components/blocks/horizontal-chart';
import { VerticalChart } from '@/components/blocks/vertical-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig } from '@/components/ui/chart';

import { minutesSincePRDate } from '@/lib/utils';

// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { config } from '../../mastra.config';

export default async function Dashboard({ githubOrg, githubRepo }: { githubOrg: string; githubRepo: string }) {
  const framework = Framework.init(config);
  const client = await framework.getIntegration('GITHUB').getApiClient({ connectionId: 'system' });

  const openPRs = await client[`/repos/${githubOrg}/${githubRepo}/pulls`].get();
  const openPRsData = await openPRs.json();

  const minutesSinceLastOpen = minutesSincePRDate(openPRsData, 'created_at', 'less');

  let morePages = true;
  let page = 1;
  let allPRsData: any[] = [];
  while (morePages) {
    const allPRs = await client[`/repos/${githubOrg}/${githubRepo}/pulls`].get({
      query: {
        state: 'all',
        per_page: 100,
        page: page,
      },
    });
    const allPRsPageData = await allPRs.json();
    allPRsData = allPRsData.concat(allPRsPageData);

    if (allPRsPageData.length === 0) {
      morePages = false;
    }
    page++;
  }

  const mergedPRs = allPRsData.filter((pr: { merged_at: null }) => pr.merged_at !== null);
  const minutesSinceLastMerge = minutesSincePRDate(mergedPRs, 'merged_at');

  const today = new Date();
  const chart1Data = [];
  let latestWeekContributorCount = 0;

  for (let i = 0; i < 8; i++) {
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() - i * 7);
    endOfWeek.setDate(endOfWeek.getDate() - (endOfWeek.getDay() - 1));
    const startOfWeek = new Date(endOfWeek);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const startOfWeekString = startOfWeek.toISOString().split('T')[0];
    const endOfWeekString = endOfWeek.toISOString().split('T')[0];

    const mergedInWeek = mergedPRs.filter((pr: { merged_at: string }) => {
      const mergedDate = pr.merged_at.split('T')[0];
      return mergedDate >= startOfWeekString && mergedDate <= endOfWeekString;
    });

    if (i === 0) {
      const uniqueAuthorsInWeek = new Set(mergedInWeek.map((pr: { user: { login: string } }) => pr.user.login));
      latestWeekContributorCount = uniqueAuthorsInWeek.size;
    }

    const startOfWeekLabel = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()}`;

    chart1Data.push({
      label: startOfWeekLabel,
      value: mergedInWeek.length,
    });
  }
  const mergedThisWeek = chart1Data[0].value;
  const mergedLastWeek = chart1Data[1].value;
  chart1Data.reverse();

  const chart1Config = {
    value: {
      label: 'PRs',
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig;

  let contributorCount = 0;
  const mergedPRsByAuthor = mergedPRs.reduce((acc: { [key: string]: number }, pr: { user: { login: string } }) => {
    const author = pr.user.login;
    if (acc[author]) {
      acc[author]++;
    } else {
      acc[author] = 1;
      contributorCount++;
    }
    return acc;
  }, {});

  const chart2Data = Object.entries(mergedPRsByAuthor)
    .map(([author, mergedPRs]) => ({
      label: author,
      value: mergedPRs as number,
    }))
    .sort((a, b) => a.value - b.value);

  const chart2Config = {
    value: {
      label: 'PRs',
      color: 'hsl(var(--chart-3))',
    },
  } satisfies ChartConfig;

  return (
    <>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Github Dashboard</h2>
          {/* <div className="flex items-center space-x-2">
              <CalendarDateRangePicker />
            </div> */}
        </div>
        {/* <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="prs" disabled>
                PRs
              </TabsTrigger>
              <TabsTrigger value="contributors" disabled>
                Contributors
              </TabsTrigger>
              <TabsTrigger value="issues" disabled>
                Issues
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4"> */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open PRs</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                <line x1="6" x2="6" y1="9" y2="21" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openPRsData.length}</div>
              <p className="text-xs text-muted-foreground">
                Oldest open PR is {Math.floor(minutesSinceLastOpen / 60 / 24)} days old
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total PRs Merged</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M6 21V9a9 9 0 0 0 9 9" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mergedPRs.length}</div>
              <p className="text-xs text-muted-foreground">Last merge {minutesSinceLastMerge} minutes ago</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">PRs Merged This Week</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mergedThisWeek}</div>
              <p className="text-xs text-muted-foreground">{`${mergedThisWeek - mergedLastWeek >= 0 ? '+' : ''}${
                mergedThisWeek - mergedLastWeek
              } PRs compared to last week`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contributors</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contributorCount}</div>
              <p className="text-xs text-muted-foreground">
                {latestWeekContributorCount} contributors merged PRs this week
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>PRs Merged by Week</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <VerticalChart chartConfig={chart1Config} chartData={chart1Data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>PRs Merged by Contributor</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalChart chartConfig={chart2Config} chartData={chart2Data} />
            </CardContent>
          </Card>
        </div>
        {/* </TabsContent>
          </Tabs> */}
      </div>
    </>
  );
}
