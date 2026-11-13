import { createCentralIcon } from './create-central-icon';

export const IconBranch = createCentralIcon('IconBranch', () => (
  <>
    <circle cx="6.5" cy="6" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6.5" cy="18" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="17.5" cy="6" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M17.5 8V10C17.5 11.1046 16.6046 12 15.5 12H8.5C7.39543 12 6.5 12.8954 6.5 14V16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
));
