'use client';

import { Content } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { VariantProps, cva } from 'class-variance-authority';
import React, { ForwardedRef, forwardRef, useImperativeHandle } from 'react';

import { useMastraEditor, WrappedEditorContent } from '@/components/editor/editor';
import { simpleEditorExtensions } from '@/components/editor/extensions/extensions';
import { RichMenu } from '@/components/editor/rich-menu';
import { useRichEmail } from '@/components/editor/use-rich-menu';

import { cn } from '@/lib/utils';

export const richTextVariants = cva(
  'bg-transparent flex flex-col gap-1 ring-offset-background text-text-dim placeholder:text-text-dim rounded-md focus-visible:ring-ring flex min-h-[80px] w-full focus-visible:outline-none  disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-thin-gray placeholder-gray focus-visible:ring-2 focus-visible:ring-offset-2',
        noBorderAndFocus:
          'ring-offset-none rounded-none border-none bg-transparent focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
        minimal:
          'border border-[#353535] placeholder-[#353535] bg-[#252525] text-text focus:border-primary/10 ring-offset-0 ring-offset-transparent ring-transparent focus-visible:ring-0 focus:visible:ring-ring-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const composeEmailEditorExtensions = [
  ...simpleEditorExtensions,
  // Figure out how to pass placeholder as props to <EditorContent/>
  Placeholder.configure({
    placeholder: () => '',
    includeChildren: true,
  }),
];

export interface RichText extends VariantProps<typeof richTextVariants> {
  value: string;
  setValue: (val: string) => void;
  className?: HTMLDivElement['className'];
}

export interface RichTextRefProps {
  updateContent: (value: Content) => void;
}

const RichText = forwardRef(
  ({ value, setValue, className, variant = 'default' }: RichText, ref: ForwardedRef<RichTextRefProps>) => {
    const { editor } = useMastraEditor({
      content: value,
      extensions: composeEmailEditorExtensions,
      testId: 'compose-email-editor',
      onUpdate: ({ editor }) => {
        setValue(editor.getHTML());
      },
    });

    const { items, headingLevel } = useRichEmail(editor!);

    useImperativeHandle(ref, () => ({
      updateContent: value => {
        editor?.commands.insertContent(value);
      },
    }));

    return (
      <div className={cn(richTextVariants({ variant }), className)}>
        <div className="min-h-0 w-full flex-1 overflow-scroll">
          <div className="h-full p-4">
            <WrappedEditorContent editor={editor} />
          </div>
        </div>
        <RichMenu items={items} headingLevel={headingLevel} />
      </div>
    );
  },
);

RichText.displayName = 'RichText';

export default RichText;
