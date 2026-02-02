'use client';

import { SectionHeader } from '@/domains/cms';
import { VariablesIcon, Icon } from '@/ds/icons';

import { extractVariableNames } from './template-utils';
import { TemplateEmptyState } from './template-empty-state';

interface VariablesDisplayProps {
  instructions: string;
}

export function VariablesDisplay({ instructions }: VariablesDisplayProps) {
  const variableNames = extractVariableNames(instructions || '');

  return (
    <section className="flex flex-col gap-3 pb-4 px-4">
      <SectionHeader
        title={
          <>
            Variables
            {variableNames.length > 0 && <span className="text-neutral3 font-normal"> ({variableNames.length})</span>}
          </>
        }
        subtitle={
          <>
            Dynamic values detected in your instructions. Referenced with{' '}
            <span className="font-mono" style={{ color: '#bd93f9' }}>
              {'{{name}}'}
            </span>
            .
          </>
        }
        icon={
          <Icon>
            <VariablesIcon className="text-accent5" />
          </Icon>
        }
      />

      {variableNames.length === 0 ? (
        <TemplateEmptyState message="No variables registered yet" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {variableNames.map(name => (
            <div
              key={name}
              className="px-3 py-1.5 rounded-md border border-border1 bg-surface3 font-mono text-ui-sm"
              style={{ color: '#bd93f9' }}
            >
              {`{{${name}}}`}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
