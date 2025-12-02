"use client";

import {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useState,
  type FC,
} from "react";
import { CircleXIcon, FileIcon } from "lucide-react";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";
import { TooltipIconButton } from "./base/tooltip-icon-button";
import { AttachmentPrimitive, useAttachment } from "@assistant-ui/react";
import {
  AvatarImage,
  AvatarRoot,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./base";
import { Dialog, DialogTrigger, DialogContent } from "./base/dialog";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { useShallow } from "zustand/shallow";
import { DialogTitle } from "@radix-ui/react-dialog";

const AttachmentRoot = withDefaults(AttachmentPrimitive.Root, {
  className: "aui-attachment-root",
});

const AttachmentContent = withDefaults("div", {
  className: "aui-attachment-content",
});

AttachmentRoot.displayName = "AttachmentRoot";

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const { file, src } = useAttachment(
    useShallow((a): { file?: File; src?: string } => {
      if (a.type !== "image") return {};
      if (a.file) return { file: a.file };
      const src = a.content?.filter((c) => c.type === "image")[0]?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      style={{
        width: "auto",
        height: "auto",
        maxWidth: "75dvh",
        maxHeight: "75dvh",
        display: isLoaded ? "block" : "none",
        overflow: "clip",
      }}
      onLoad={() => setIsLoaded(true)}
      alt="Preview"
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger className="aui-attachment-preview-trigger" asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="aui-sr-only">
          Image Attachment Preview
        </DialogTitle>
        <AttachmentPreview src={src} />
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const isImage = useAttachment((a) => a.type === "image");
  const src = useAttachmentSrc();
  return (
    <AvatarRoot className="aui-attachment-thumb">
      <AvatarFallback delayMs={isImage ? 200 : 0}>
        <FileIcon />
      </AvatarFallback>
      <AvatarImage src={src} />
    </AvatarRoot>
  );
};

const AttachmentUI: FC = () => {
  const canRemove = useAttachment((a) => a.source !== "message");
  const typeLabel = useAttachment((a) => {
    const type = a.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown attachment type: ${_exhaustiveCheck}`);
    }
  });
  return (
    <Tooltip>
      <AttachmentRoot>
        <AttachmentPreviewDialog>
          <TooltipTrigger asChild>
            <AttachmentContent>
              <AttachmentThumb />
              <div className="aui-attachment-text">
                <p className="aui-attachment-name">
                  <AttachmentPrimitive.Name />
                </p>
                <p className="aui-attachment-type">{typeLabel}</p>
              </div>
            </AttachmentContent>
          </TooltipTrigger>
        </AttachmentPreviewDialog>
        {canRemove && <AttachmentRemove />}
      </AttachmentRoot>
      <TooltipContent side="top">
        <AttachmentPrimitive.Name />
      </TooltipContent>
    </Tooltip>
  );
};

AttachmentUI.displayName = "Attachment";

namespace AttachmentRemove {
  export type Element = HTMLButtonElement;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AttachmentRemove = forwardRef<
  AttachmentRemove.Element,
  AttachmentRemove.Props
>((props, ref) => {
  const {
    strings: {
      composer: { removeAttachment: { tooltip = "Remove file" } = {} } = {},
    } = {},
  } = useThreadConfig();

  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip={tooltip}
        className="aui-attachment-remove"
        side="top"
        {...props}
        ref={ref}
      >
        {props.children ?? <CircleXIcon />}
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
});

AttachmentRemove.displayName = "AttachmentRemove";

const exports = {
  Root: AttachmentRoot,
  Remove: AttachmentRemove,
};

export default Object.assign(AttachmentUI, exports) as typeof AttachmentUI &
  typeof exports;
