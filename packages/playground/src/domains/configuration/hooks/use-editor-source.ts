import { useMastraPackages } from '@mastra/react/hooks';

export type EditorSource = 'code' | 'db';

export const useEditorSource = (): EditorSource => {
  const { data } = useMastraPackages();
  return data?.editorSource === 'code' ? 'code' : 'db';
};
