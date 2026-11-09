import { useState } from 'react';

import type { BoardOpenCard } from '../context/BoardOpenCardContext';

export interface LinkedComment {
  cardKey: string;
  commentId: string;
}

interface OpenCardChoice {
  linkedComment: LinkedComment | undefined;
  key: string | undefined;
}

const sameLink = (a: LinkedComment | undefined, b: LinkedComment | undefined) =>
  a?.cardKey === b?.cardKey && a?.commentId === b?.commentId;

const openKeyOf = (choice: OpenCardChoice | undefined, linkedComment: LinkedComment | undefined) =>
  choice !== undefined && sameLink(choice.linkedComment, linkedComment) ? choice.key : linkedComment?.cardKey;

/** A comment link opens its card; a click or a dismissal overrides it until the next link arrives. */
export function useOpenCardState(linkedComment: LinkedComment | undefined): BoardOpenCard {
  const [choice, setChoice] = useState<OpenCardChoice>();

  return {
    openKey: openKeyOf(choice, linkedComment),
    setCardOpen: (key, open) => {
      if (open) setChoice({ linkedComment, key });
      else
        setChoice(current => (openKeyOf(current, linkedComment) === key ? { linkedComment, key: undefined } : current));
    },
  };
}
