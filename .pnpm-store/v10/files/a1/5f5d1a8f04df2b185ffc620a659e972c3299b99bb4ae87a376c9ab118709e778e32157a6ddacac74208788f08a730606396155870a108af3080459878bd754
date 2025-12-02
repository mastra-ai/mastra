import { FC, memo } from "react";
import { CodeHeader } from "./code-header";
import classNames from "classnames";
import {
  MarkdownTextPrimitive,
  MarkdownTextPrimitiveProps,
  unstable_memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import { INTERNAL } from "@assistant-ui/react";

const { withSmoothContextProvider, useSmoothStatus } = INTERNAL;

export type MakeMarkdownTextProps = MarkdownTextPrimitiveProps;

const defaultComponents = unstable_memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1 className={classNames("aui-md-h1", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={classNames("aui-md-h2", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={classNames("aui-md-h3", className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={classNames("aui-md-h4", className)} {...props} />
  ),
  h5: ({ className, ...props }) => (
    <h5 className={classNames("aui-md-h5", className)} {...props} />
  ),
  h6: ({ className, ...props }) => (
    <h6 className={classNames("aui-md-h6", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={classNames("aui-md-p", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a className={classNames("aui-md-a", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={classNames("aui-md-blockquote", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={classNames("aui-md-ul", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={classNames("aui-md-ol", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={classNames("aui-md-hr", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <table className={classNames("aui-md-table", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th className={classNames("aui-md-th", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={classNames("aui-md-td", className)} {...props} />
  ),
  tr: ({ className, ...props }) => (
    <tr className={classNames("aui-md-tr", className)} {...props} />
  ),
  sup: ({ className, ...props }) => (
    <sup className={classNames("aui-md-sup", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre className={classNames("aui-md-pre", className)} {...props} />
  ),
  code: ({ className, ...props }) => {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={classNames(!isCodeBlock && "aui-md-inline-code", className)}
        {...props}
      />
    );
  },
  CodeHeader,
});

export const makeMarkdownText = ({
  className,
  components: userComponents,
  ...rest
}: MakeMarkdownTextProps = {}) => {
  const components = {
    ...defaultComponents,
    ...Object.fromEntries(
      // ignore undefined values, so undefined values do not override default components
      Object.entries(userComponents ?? {}).filter(([_, v]) => v !== undefined),
    ),
  };

  const MarkdownTextImpl: FC = () => {
    const status = useSmoothStatus();
    return (
      <MarkdownTextPrimitive
        components={components}
        {...rest}
        className={classNames(
          status.type === "running" && "aui-md-running",
          className,
        )}
      />
    );
  };
  MarkdownTextImpl.displayName = "MarkdownText";

  return memo(withSmoothContextProvider(MarkdownTextImpl), () => true);
};
