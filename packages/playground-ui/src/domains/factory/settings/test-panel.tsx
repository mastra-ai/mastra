import { useIntakeTestQuery } from '@mastra/react/hooks/factory';

import { IntakeTestPanel } from '..';
import { TestResult } from './test-result';

export interface TestPanelProps {
  factoryId: string;
  boardId: string;
  /** A GitHub/Linear URL, or a work item id (from "Why?" on routing's Not routed list). */
  subject: string;
  /** The pencil on a rule: the parent opens `?rule=<id>&test=<subject>`. */
  onEditRule: (routeId: string) => void;
  onClose: () => void;
}

/** "Where would this go?" for one item: which board takes it and what every rule answered. Nothing is filed. */
export function TestPanel({ factoryId, boardId, subject, onEditRule, onClose }: TestPanelProps) {
  const test = useIntakeTestQuery(factoryId, subject);
  const data = test.data;

  return (
    <IntakeTestPanel
      subject={subject}
      error={test.error?.message}
      result={
        data
          ? close => (
              <TestResult result={data} factoryId={factoryId} boardId={boardId} close={close} onEditRule={onEditRule} />
            )
          : undefined
      }
      onClose={onClose}
    />
  );
}
