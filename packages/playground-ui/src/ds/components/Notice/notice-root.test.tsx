// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { Notice } from './Notice';

// jsdom has no layout engine, so scrollWidth cannot prove the overflow here.
// These assert the guards that keep an unbreakable token inside the box:
// `min-w-0` down the flex chain and `wrap-anywhere` on the text.
const gitRemoteFailure =
  "could not set 'remote.origin.url' to 'https://x-access-token:ghs_EXAMPLEtokenaGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9@github.com/mastra-ai/mastra.git'";

const classesOf = (element: Element | null, label: string) => {
  assert(element, `Expected ${label}`);
  return [...element.classList];
};

afterEach(cleanup);

describe('NoticeRoot', () => {
  it('lets a message with no break opportunity wrap inside the box', () => {
    render(<Notice variant="destructive">{gitRemoteFailure}</Notice>);

    const message = screen.getByText(gitRemoteFailure);
    expect(classesOf(message, 'the message')).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']));
    expect(classesOf(message.parentElement, 'the icon/message row')).toContain('min-w-0');
  });

  it('applies the same guard to the titled variant', () => {
    render(
      <Notice variant="destructive" title="Workspace unavailable">
        <Notice.Message>{gitRemoteFailure}</Notice.Message>
      </Notice>,
    );

    const body = screen.getByText(gitRemoteFailure).parentElement;
    expect(classesOf(body, 'the message body')).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']));
  });

  it('truncates a long title instead of wrapping it out of the fixed-height row', () => {
    const title = 'A title long enough to outgrow the notice width on its own';
    render(<Notice variant="warning" title={title} />);

    const titleElement = screen.getByText(title);
    expect(classesOf(titleElement, 'the title')).toContain('truncate');
    expect(classesOf(titleElement.parentElement, 'the title row')).toContain('min-w-0');
  });
});
