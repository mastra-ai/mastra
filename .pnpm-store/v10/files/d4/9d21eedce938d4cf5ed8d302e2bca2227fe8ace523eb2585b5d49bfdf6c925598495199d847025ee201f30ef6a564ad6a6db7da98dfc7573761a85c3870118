"use client";

import type { FC, PropsWithChildren } from "react";
import { useComposer } from "../../context/react/ComposerContext";
import type { RequireAtLeastOne } from "../../utils/RequireAtLeastOne";

type ComposerIfFilters = {
  editing: boolean | undefined;
};

export type UseComposerIfProps = RequireAtLeastOne<ComposerIfFilters>;

const useComposerIf = (props: UseComposerIfProps) => {
  return useComposer((composer) => {
    if (props.editing === true && !composer.isEditing) return false;
    if (props.editing === false && composer.isEditing) return false;

    return true;
  });
};

export namespace ComposerPrimitiveIf {
  export type Props = PropsWithChildren<UseComposerIfProps>;
}

export const ComposerPrimitiveIf: FC<ComposerPrimitiveIf.Props> = ({
  children,
  ...query
}) => {
  const result = useComposerIf(query);
  return result ? children : null;
};

ComposerPrimitiveIf.displayName = "ComposerPrimitive.If";
