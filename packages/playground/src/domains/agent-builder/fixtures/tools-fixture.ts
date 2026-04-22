export type ToolFixture = {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'data' | 'files' | 'communication' | 'automation';
  enabled: boolean;
};

export const toolsFixture: ToolFixture[] = [
  {
    id: 'web-search',
    name: 'Web search',
    description: 'Search the open web for up-to-date information.',
    category: 'web',
    enabled: true,
  },
  {
    id: 'http-fetch',
    name: 'HTTP fetch',
    description: 'Fetch arbitrary HTTP endpoints and parse JSON or text.',
    category: 'web',
    enabled: false,
  },
  {
    id: 'sql-query',
    name: 'SQL query',
    description: 'Run read-only SQL queries against connected warehouses.',
    category: 'data',
    enabled: true,
  },
  {
    id: 'file-read',
    name: 'Read files',
    description: 'Read text files from the configured workspace.',
    category: 'files',
    enabled: false,
  },
  {
    id: 'slack-post',
    name: 'Post to Slack',
    description: 'Send messages to a Slack channel on the agent’s behalf.',
    category: 'communication',
    enabled: false,
  },
  {
    id: 'email-send',
    name: 'Send email',
    description: 'Compose and send transactional emails.',
    category: 'communication',
    enabled: false,
  },
  {
    id: 'calendar-create',
    name: 'Create calendar event',
    description: 'Create events on a connected Google or Outlook calendar.',
    category: 'automation',
    enabled: false,
  },
];
