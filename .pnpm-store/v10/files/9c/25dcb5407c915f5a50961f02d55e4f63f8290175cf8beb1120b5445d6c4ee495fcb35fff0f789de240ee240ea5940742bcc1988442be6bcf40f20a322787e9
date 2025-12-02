"use client";

// src/primitives/composer/ComposerInput.tsx
import { composeEventHandlers } from "@radix-ui/primitive";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { Slot } from "@radix-ui/react-slot";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  useComposer,
  useComposerRuntime
} from "../../context/react/ComposerContext.js";
import { useThread, useThreadRuntime } from "../../context/react/ThreadContext.js";
import { useEscapeKeydown } from "@radix-ui/react-use-escape-keydown";
import { useOnScrollToBottom } from "../../utils/hooks/useOnScrollToBottom.js";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext.js";
import { jsx } from "react/jsx-runtime";
var ComposerPrimitiveInput = forwardRef(
  ({
    autoFocus = false,
    asChild,
    disabled: disabledProp,
    onChange,
    onKeyDown,
    onPaste,
    submitOnEnter = true,
    cancelOnEscape = true,
    unstable_focusOnRunStart = true,
    unstable_focusOnScrollToBottom = true,
    unstable_focusOnThreadSwitched = true,
    addAttachmentOnPaste = true,
    ...rest
  }, forwardedRef) => {
    const threadListItemRuntime = useThreadListItemRuntime();
    const threadRuntime = useThreadRuntime();
    const composerRuntime = useComposerRuntime();
    const value = useComposer((c) => {
      if (!c.isEditing) return "";
      return c.text;
    });
    const Component = asChild ? Slot : TextareaAutosize;
    const isDisabled = Boolean(useThread((t) => t.isDisabled) || disabledProp);
    const textareaRef = useRef(null);
    const ref = useComposedRefs(forwardedRef, textareaRef);
    useEscapeKeydown((e) => {
      if (!cancelOnEscape) return;
      if (composerRuntime.getState().canCancel) {
        composerRuntime.cancel();
        e.preventDefault();
      }
    });
    const handleKeyPress = (e) => {
      if (isDisabled || !submitOnEnter) return;
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && e.shiftKey === false) {
        const { isRunning } = threadRuntime.getState();
        if (!isRunning) {
          e.preventDefault();
          textareaRef.current?.closest("form")?.requestSubmit();
        }
      }
    };
    const handlePaste = async (e) => {
      if (!addAttachmentOnPaste) return;
      const threadCapabilities = threadRuntime.getState().capabilities;
      const files = Array.from(e.clipboardData?.files || []);
      if (threadCapabilities.attachments && files.length > 0) {
        try {
          e.preventDefault();
          await Promise.all(
            files.map((file) => composerRuntime.addAttachment(file))
          );
        } catch (error) {
          console.error("Error adding attachment:", error);
        }
      }
    };
    const autoFocusEnabled = autoFocus && !isDisabled;
    const focus = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea || !autoFocusEnabled) return;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [autoFocusEnabled]);
    useEffect(() => focus(), [focus]);
    useOnScrollToBottom(() => {
      if (composerRuntime.type === "thread" && unstable_focusOnScrollToBottom) {
        focus();
      }
    });
    useEffect(() => {
      if (composerRuntime.type !== "thread" || !unstable_focusOnRunStart)
        return void 0;
      return threadRuntime.unstable_on("run-start", focus);
    }, [unstable_focusOnRunStart, focus, composerRuntime, threadRuntime]);
    useEffect(() => {
      if (composerRuntime.type !== "thread" || !unstable_focusOnThreadSwitched)
        return void 0;
      return threadListItemRuntime.unstable_on("switched-to", focus);
    }, [
      unstable_focusOnThreadSwitched,
      focus,
      composerRuntime,
      threadListItemRuntime
    ]);
    return /* @__PURE__ */ jsx(
      Component,
      {
        name: "input",
        value,
        ...rest,
        ref,
        disabled: isDisabled,
        onChange: composeEventHandlers(onChange, (e) => {
          if (!composerRuntime.getState().isEditing) return;
          return composerRuntime.setText(e.target.value);
        }),
        onKeyDown: composeEventHandlers(onKeyDown, handleKeyPress),
        onPaste: composeEventHandlers(onPaste, handlePaste)
      }
    );
  }
);
ComposerPrimitiveInput.displayName = "ComposerPrimitive.Input";
export {
  ComposerPrimitiveInput
};
//# sourceMappingURL=ComposerInput.js.map