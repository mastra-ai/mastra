"use client";

import { forwardRef, type FC } from "react";

import { Button, ButtonProps } from "./base/button";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";
import { ComposerPrimitive } from "@assistant-ui/react";

const EditComposer: FC = () => {
  return (
    <EditComposerRoot>
      <EditComposerInput />

      <EditComposerFooter>
        <EditComposerCancel />
        <EditComposerSend />
      </EditComposerFooter>
    </EditComposerRoot>
  );
};

EditComposer.displayName = "EditComposer";

const EditComposerRoot = withDefaults(ComposerPrimitive.Root, {
  className: "aui-edit-composer-root",
});

EditComposerRoot.displayName = "EditComposerRoot";

const EditComposerInput = withDefaults(ComposerPrimitive.Input, {
  className: "aui-edit-composer-input",
});

EditComposerInput.displayName = "EditComposerInput";

const EditComposerFooter = withDefaults("div", {
  className: "aui-edit-composer-footer",
});

EditComposerFooter.displayName = "EditComposerFooter";

namespace EditComposerCancel {
  export type Element = HTMLButtonElement;
  export type Props = Partial<ButtonProps>;
}

const EditComposerCancel = forwardRef<
  EditComposerCancel.Element,
  EditComposerCancel.Props
>((props, ref) => {
  const {
    strings: { editComposer: { cancel: { label = "Cancel" } = {} } = {} } = {},
  } = useThreadConfig();
  return (
    <ComposerPrimitive.Cancel asChild>
      <Button variant="ghost" {...props} ref={ref}>
        {props.children ?? label}
      </Button>
    </ComposerPrimitive.Cancel>
  );
});

EditComposerCancel.displayName = "EditComposerCancel";

namespace EditComposerSend {
  export type Element = HTMLButtonElement;
  export type Props = Partial<ButtonProps>;
}

const EditComposerSend = forwardRef<
  EditComposerSend.Element,
  EditComposerSend.Props
>((props, ref) => {
  const {
    strings: { editComposer: { send: { label = "Send" } = {} } = {} } = {},
  } = useThreadConfig();
  return (
    <ComposerPrimitive.Send asChild>
      <Button {...props} ref={ref}>
        {props.children ?? label}
      </Button>
    </ComposerPrimitive.Send>
  );
});

EditComposerSend.displayName = "EditComposerSend";

const exports = {
  Root: EditComposerRoot,
  Input: EditComposerInput,
  Footer: EditComposerFooter,
  Cancel: EditComposerCancel,
  Send: EditComposerSend,
};

export default Object.assign(EditComposer, exports) as typeof EditComposer &
  typeof exports;
