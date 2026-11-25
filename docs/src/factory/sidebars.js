/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    { type: 'doc', id: 'index', label: 'Get started' },
    { type: 'doc', id: 'what-is-factory', label: "What's Factory?" },
    {
      type: 'category',
      label: 'Core concepts',
      collapsed: false,
      items: [
        { type: 'doc', id: 'using/intake', label: 'Intake' },
        { type: 'doc', id: 'using/work-and-approvals', label: 'Work items' },
        { type: 'doc', id: 'using/reviews', label: 'Review items' },
        { type: 'doc', id: 'using/sessions', label: 'Sessions' },
        { type: 'doc', id: 'using/messaging', label: 'Work across sessions' },
        { type: 'doc', id: 'using/previews', label: 'App previews' },
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: true,
      items: [
        { type: 'doc', id: 'configure/models', label: 'Models' },
        { type: 'doc', id: 'configure/github', label: 'GitHub' },
        { type: 'doc', id: 'configure/gitlab', label: 'GitLab' },
        { type: 'doc', id: 'configure/linear', label: 'Linear' },
        { type: 'doc', id: 'configure/jira', label: 'Jira' },
        { type: 'doc', id: 'configure/incidentio', label: 'incident.io' },
        { type: 'doc', id: 'configure/slack', label: 'Slack' },
        { type: 'doc', id: 'configure/auth', label: 'Auth' },
        { type: 'doc', id: 'configure/sandboxes', label: 'Sandboxes' },
        { type: 'doc', id: 'configure/storage', label: 'Storage' },
        { type: 'doc', id: 'configure/boards-and-rules', label: 'Boards and rules' },
        { type: 'doc', id: 'configure/custom-skills', label: 'Custom skills' },
        { type: 'doc', id: 'configure/metrics', label: 'Health metrics' },
      ],
    },
    { type: 'doc', id: 'deployment', label: 'Deployment' },
    { type: 'doc', id: 'skill', label: 'Agent skill' },
    { type: 'doc', id: 'troubleshooting', label: 'Troubleshooting' },
    {
      type: 'category',
      label: 'Reference',
      items: [
        { type: 'doc', id: 'reference/environment-variables', label: 'Environment variables' },
        { type: 'doc', id: 'reference/mastra-factory-api', label: 'MastraFactory API' },
        { type: 'doc', id: 'reference/create-factory', label: 'create-factory' },
      ],
    },
  ],
}

export default sidebars
