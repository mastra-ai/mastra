import { createCentralIcon } from './create-central-icon';

export const IconPlugin1 = createCentralIcon('IconPlugin1', () => (
  <>
    <path
      d="M19 14V9C19 7.89543 18.1046 7 17 7H7C5.89543 7 5 7.89543 5 9V14C5 16.2091 6.79086 18 9 18H15C17.2091 18 19 16.2091 19 14Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 18V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>
));
