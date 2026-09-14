import { createRef } from 'react';
import { expectTypeOf, test } from 'vitest';

import { PlanPath, PlanTitle } from '../../ai/plan/plan';
import { ToolCallDetail, ToolCallLabel } from '../../ai/tool-call/tool-call';
import { ClampedText } from '../../ClampedText';
import { Truncate } from '../../Truncate';
import { Txt } from '../Txt';

test('infers refs and events from the selected tag', () => {
  <Txt
    ref={element => {
      expectTypeOf(element).toEqualTypeOf<HTMLParagraphElement | null>();
    }}
    onClick={event => {
      expectTypeOf(event.currentTarget).toEqualTypeOf<EventTarget & HTMLParagraphElement>();
    }}
  />;

  <Txt
    as="label"
    htmlFor="name"
    ref={element => {
      expectTypeOf(element).toEqualTypeOf<HTMLLabelElement | null>();
    }}
    onClick={event => {
      expectTypeOf(event.currentTarget).toEqualTypeOf<EventTarget & HTMLLabelElement>();
    }}
  />;

  <Txt as="h1" ref={createRef<HTMLHeadingElement>()} />;
  <Txt as="span" ref={createRef<HTMLSpanElement>()} />;
  <Txt as="div" ref={createRef<HTMLDivElement>()} />;
});

test('rejects refs and attributes that do not match the selected tag', () => {
  // @ts-expect-error A button ref cannot receive a label.
  <Txt as="label" ref={createRef<HTMLButtonElement>()} />;
  // @ts-expect-error The default paragraph cannot receive a label ref.
  <Txt ref={createRef<HTMLLabelElement>()} />;
  // @ts-expect-error htmlFor belongs to labels.
  <Txt as="p" htmlFor="name" />;
  // @ts-expect-error The default paragraph has no htmlFor attribute.
  <Txt htmlFor="name" />;
  // @ts-expect-error Txt only supports text elements.
  <Txt as="button" />;
});

test('preserves tag inference through text wrappers', () => {
  <ClampedText as="label" htmlFor="name">
    Name
  </ClampedText>;
  <Truncate as="label" htmlFor="name" ref={createRef<HTMLLabelElement>()}>
    Name
  </Truncate>;
  <Truncate ref={createRef<HTMLSpanElement>()}>Name</Truncate>;
  // @ts-expect-error A button ref cannot receive a label through Truncate.
  <Truncate as="label" ref={createRef<HTMLButtonElement>()}>
    Name
  </Truncate>;
  // @ts-expect-error The default clamped paragraph has no htmlFor attribute.
  <ClampedText htmlFor="name">Name</ClampedText>;
  // @ts-expect-error Truncate defaults to a span.
  <Truncate htmlFor="name">Name</Truncate>;
});

test('keeps compound text components tied to their rendered tags', () => {
  <PlanTitle ref={createRef<HTMLHeadingElement>()}>Plan</PlanTitle>;
  <PlanPath ref={createRef<HTMLParagraphElement>()}>plan.md</PlanPath>;
  <ToolCallLabel as="label" htmlFor="name" ref={createRef<HTMLLabelElement>()} />;
  <ToolCallDetail as="h3" ref={createRef<HTMLHeadingElement>()} />;
  // @ts-expect-error Plan titles render headings.
  <PlanTitle ref={createRef<HTMLLabelElement>()}>Plan</PlanTitle>;
  // @ts-expect-error A button ref cannot receive a tool-call label.
  <ToolCallLabel as="label" ref={createRef<HTMLButtonElement>()} />;
});
