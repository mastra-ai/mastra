import { createCentralIcon } from './create-central-icon';

export const IconLoadingCircle = createCentralIcon('IconLoadingCircle', () => (
  <>
    <path
      d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="2"
    />
    <path
      d="M20.9451 13C20.4839 17.1716 17.1716 20.4839 13 20.9451"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </>
));
