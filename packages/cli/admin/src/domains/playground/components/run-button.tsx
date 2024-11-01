'use client';

import React from 'react';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

type RunApiOrEventProps =
  | {
      context: 'api';
      apiIsRunning: boolean;
      onClick: () => void;
    }
  | {
      context: 'event';
      eventIsRunning: boolean;
      onClick: () => void;
    };

function RunApiOrEvent(props: RunApiOrEventProps) {
  const isRunning = props.context == 'api' ? props.apiIsRunning : props.eventIsRunning;
  return (
    <Button
      variant={'ghost'}
      onClick={props.onClick}
      disabled={isRunning}
      className="justify-center z-30 bg-transparent absolute inset-0 rounded flex items-center gap-1 text-sm font-medium text-mastra-el-5"
    >
      {isRunning ? (
        <span className="flex gap-1 items-center">
          <Spinner className="w-3 h-3" /> Running
        </span>
      ) : (
        <span className="flex gap-1 items-center">
          <Icon name="activity" />
          {props.context === 'api' ? 'Run' : 'Trigger'} <span className="capitalize">{props.context}</span>
        </span>
      )}
    </Button>
  );
}

export { RunApiOrEvent };
