import { createFramework } from '@arkw/core';
import { Metadata } from 'next';

// import { CalendarDateRangePicker } from '@/components/blocks/date-range-picker';
import { Overview } from '@/components/blocks/overview';
// import RepoSwitcher from '@/components/blocks/repo-switcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { config } from '../../arkw.config';

export const metadata: Metadata = {
  title: 'Github Dashboard',
  description: 'Your Personal Github Dashboard.',
};

export default async function DashboardPage() {
  const framework = createFramework(config);
  const client = await framework.getIntegration('GITHUB').getApiClient({ referenceId: 'shane-real' });
  console.log('client', client);
  const repos = await client['/repos/kepler-inc/future/pulls'].get();
  const repoData = await repos.json();
  console.log('repoData', repoData);
  //const mergedPRs = repoData.filter((pr: { merged_at: null }) => pr.merged_at !== null);
  //console.log("mergedPRs", mergedPRs);

  const orgs = await client['/organizations'].get();
  const orgData = await orgs.json();
  console.log('orgData', orgData);

  return (
    <>
      <div className="hidden flex-col md:flex">
        {/* <div className="border-b">
          <div className="flex h-16 items-center px-4">
            <RepoSwitcher />
          </div>
        </div> */}
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
                <CardTitle className="text-sm font-medium">PRs Merged</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">32</div>
                <p className="text-xs text-muted-foreground">+20.0% from previous period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commits</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">321</div>
                <p className="text-xs text-muted-foreground">+180.1% from previous period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contributors</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">6</div>
                <p className="text-xs text-muted-foreground">+0% from previous period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Issues Closed</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">+0% from prevoius period</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>PRs Merged by Day</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <Overview />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Issues Closed by Day</CardTitle>
              </CardHeader>
              <CardContent>Fix this</CardContent>
            </Card>
          </div>
          {/* </TabsContent>
          </Tabs> */}
        </div>
      </div>
    </>
  );
}
