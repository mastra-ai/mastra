import type { ComponentBinding, ComponentDeclaration } from "../components/catalog.ts";
import type { VerifiedResult } from "../analysis/contracts.ts";
import type { WorkspaceAction } from "../workspace/contracts.ts";

export interface RendererProps {
  binding: ComponentBinding;
  result: VerifiedResult;
  declaration: ComponentDeclaration;
  act: (action: WorkspaceAction) => void;
}
