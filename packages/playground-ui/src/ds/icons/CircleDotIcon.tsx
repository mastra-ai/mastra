import { createCentralIcon } from './central/create-central-icon';

/**
 * A ring with a dot in it: something open, or made by hand rather than by an integration. None of
 * the Central icons this package installs is a ring with a dot (`IconCircleRecord` is a voicemail
 * mark), so this one is drawn on Central's grid and stroke, through the same renderer, to sit beside
 * them unchanged.
 */
export const CircleDotIcon = createCentralIcon('CircleDotIcon', () => (
  <>
    <path
      d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </>
));
