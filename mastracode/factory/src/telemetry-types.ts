/** Browser-safe vocabulary: never send URLs, route parameters, or input contents. */
export const FACTORY_WEB_PAGES = [
  'onboarding',
  'work',
  'review',
  'overview',
  'attention',
  'activity',
  'rules',
  'audit',
  'knowledge',
  'settings',
  'slack_connection',
  'workspace',
  'thread',
  'supervisor',
  'new_session',
  'new_factory',
] as const;

export interface FactoryWebActivity {
  activity: 'page_view' | 'interaction';
  page: (typeof FACTORY_WEB_PAGES)[number];
}
