import { createCentralIcon } from './create-central-icon';

export const IconArrowUpWall = createCentralIcon('IconArrowUpWall', () => (
  <>
    <path
      d="M16.25 8L12 3.75L7.75 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M19 20L5 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 5V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>
));
