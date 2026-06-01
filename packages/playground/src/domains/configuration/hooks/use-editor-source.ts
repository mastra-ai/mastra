import { useMastraPackages } from './use-mastra-packages';

export type EditorSource = 'code' | 'db';

export const useEditorSource = (): EditorSource => {
  const { data } = useMastraPackages();
  return data?.editorSource === 'code' ? 'code' : 'db';
};
