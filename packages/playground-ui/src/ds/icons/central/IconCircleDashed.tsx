import { createCentralIcon } from './create-central-icon';

export const IconCircleDashed = createCentralIcon('IconCircleDashed', () => (
  <path
    d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeDasharray="3 4"
  />
));
