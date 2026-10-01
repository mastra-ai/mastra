import { useToolDrawerParam } from '../../hooks/use-tool-drawer-param';
import { ToolDrawer } from './tool-drawer';
import { ToolsPageDrawerBody } from './tools-page-tool-drawer-body';

/** The drawer on the Tools page, opened by `?tool=`. */
export function ToolsPageToolDrawer() {
  const { toolId, close } = useToolDrawerParam();

  return (
    <ToolDrawer open={toolId !== undefined} onClose={close} toolId={toolId ?? ''}>
      {toolId && <ToolsPageDrawerBody key={toolId} toolId={toolId} />}
    </ToolDrawer>
  );
}
