import { createCentralIcon } from './create-central-icon';

export const IconGlobe = createCentralIcon('IconGlobe', () => (
  <>
    <path
      d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
    />
    <path d="M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    <path
      d="M12 21C10.067 21 8.5 16.9706 8.5 12C8.5 7.02944 10.067 3 12 3C13.933 3 15.5 7.02944 15.5 12C15.5 16.9706 13.933 21 12 21Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
    />
  </>
));
