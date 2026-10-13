import { createContext, useContext } from 'react';

export type DataPanelVariant = 'drawer' | 'inline';

// Defaults to `drawer` so sub-components rendered outside a `DataPanel` keep their historical behavior.
export const DataPanelVariantContext = createContext<DataPanelVariant>('drawer');

export const useDataPanelVariant = () => useContext(DataPanelVariantContext);
