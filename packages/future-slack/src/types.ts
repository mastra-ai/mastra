import { IntegrationAPI } from '../api';

import { SlackClient } from './client';

export type MakeClient = ({ api }: { api: IntegrationAPI }) => Promise<SlackClient>;
