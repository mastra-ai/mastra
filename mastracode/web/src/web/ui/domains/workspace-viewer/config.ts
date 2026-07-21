export interface RenderedWorkspacePath {
  id: string;
  label: string;
  root: string;
}

export const renderedPaths: RenderedWorkspacePath[] = [{ id: 'artifacts', label: 'Artifacts', root: '.artifacts' }];
