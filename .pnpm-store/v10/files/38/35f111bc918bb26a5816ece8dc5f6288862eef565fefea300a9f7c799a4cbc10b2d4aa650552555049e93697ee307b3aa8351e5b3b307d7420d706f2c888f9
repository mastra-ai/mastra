"use client";

import { forwardRef, type FC } from "react";
import { PencilIcon } from "lucide-react";

import { TooltipIconButton } from "./base/tooltip-icon-button";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";
import { useThread, ActionBarPrimitive } from "@assistant-ui/react";

const useAllowEdit = (ensureCapability = false) => {
  const { userMessage: { allowEdit = true } = {} } = useThreadConfig();
  const editSupported = useThread((t) => t.capabilities.edit);
  return allowEdit && (!ensureCapability || editSupported);
};

const UserActionBar: FC = () => {
  const allowEdit = useAllowEdit(true);
  if (!allowEdit) return null;
  return (
    <UserActionBarRoot hideWhenRunning autohide="not-last">
      <UserActionBarEdit />
    </UserActionBarRoot>
  );
};

UserActionBar.displayName = "UserActionBar";

const UserActionBarRoot = withDefaults(ActionBarPrimitive.Root, {
  className: "aui-user-action-bar-root",
});

UserActionBarRoot.displayName = "UserActionBarRoot";

namespace UserActionBarEdit {
  export type Element = ActionBarPrimitive.Edit.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const UserActionBarEdit = forwardRef<
  UserActionBarEdit.Element,
  UserActionBarEdit.Props
>((props, ref) => {
  const {
    strings: { userMessage: { edit: { tooltip = "Edit" } = {} } = {} } = {},
  } = useThreadConfig();
  const allowEdit = useAllowEdit();
  return (
    <ActionBarPrimitive.Edit disabled={!allowEdit} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <PencilIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  );
});

UserActionBarEdit.displayName = "UserActionBarEdit";

const exports = {
  Root: UserActionBarRoot,
  Edit: UserActionBarEdit,
};

export default Object.assign(UserActionBar, exports) as typeof UserActionBar &
  typeof exports;
