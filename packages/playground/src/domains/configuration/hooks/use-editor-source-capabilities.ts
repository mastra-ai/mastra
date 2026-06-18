import { useMastraPackages } from './use-mastra-packages';

type EditorSourceCapabilities = {
  source: 'code' | 'db';
  storage: 'database' | 'filesystem' | 'source-provider' | 'unavailable';
  provider?: {
    id: string;
    displayName: string;
  };
  canSave: boolean;
  canOpenChangeRequest: boolean;
  unavailableReason?: string;
};

type SystemPackagesWithSourceCapabilities = {
  editorSourceCapabilities?: EditorSourceCapabilities;
};

export const useEditorSourceCapabilities = () => {
  const { data } = useMastraPackages();

  return (data as SystemPackagesWithSourceCapabilities | undefined)?.editorSourceCapabilities;
};
