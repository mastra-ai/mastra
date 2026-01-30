'use client';

import { useMemo } from 'react';

import { Header, HeaderGroup, HeaderAction, HeaderTitle } from '@/ds/components/Header';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import { Spinner } from '@/ds/components/Spinner';
import { Icon } from '@/ds/icons/Icon';
import { AgentIcon } from '@/ds/icons/AgentIcon';

export interface AgentCreateHeaderProps {
  onPublish: () => void;
  isSubmitting?: boolean;
}

export function AgentCreateHeader({ onPublish, isSubmitting = false }: AgentCreateHeaderProps) {
  // Mocked revisions data for now
  const mockRevisions = useMemo(
    () => [
      { label: `Draft`, value: 'current' },
      { label: `v1.0`, value: 'v1' },
    ],
    [],
  );

  return (
    <Header border={false}>
      <HeaderGroup>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create Agent
        </HeaderTitle>
      </HeaderGroup>
      <HeaderGroup>
        <Combobox
          options={mockRevisions}
          placeholder="Revisions"
          value="current"
          onValueChange={() => {}}
          variant="ghost"
          size="sm"
        />
      </HeaderGroup>
      <HeaderAction>
        <Button variant="primary" onClick={onPublish} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Publishing...
            </>
          ) : (
            'Publish'
          )}
        </Button>
      </HeaderAction>
    </Header>
  );
}
