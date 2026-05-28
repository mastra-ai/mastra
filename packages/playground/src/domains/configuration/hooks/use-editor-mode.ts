import { useMastraPackages } from './use-mastra-packages';

export type EditorMode = 'code' | 'db';

export const useEditorMode = (): EditorMode => {
  const { data } = useMastraPackages();
  return data?.editorMode === 'code' ? 'code' : 'db';
};
