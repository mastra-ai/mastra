import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, MessageSquare, UserRound } from 'lucide-react';
import type { FigureMode } from '../figures/types';
import { OnboardingAnnotation } from './OnboardingAnnotation';

export function OnboardingAccountLabels({ mode = 'shared' }: { mode?: FigureMode }) {
  return (
    <>
      <OnboardingAnnotation x={158} y={62} width={84}>
        <div className="flex items-center gap-2">
          {mode === 'individual' ? (
            <UserRound className="text-muted-foreground size-3" />
          ) : (
            <Building2 className="text-muted-foreground size-3" />
          )}
          <Txt variant="meta">{mode === 'individual' ? 'Personal' : 'Company'}</Txt>
        </div>
      </OnboardingAnnotation>
      {mode === 'individual' && (
        <OnboardingAnnotation x={38} y={54} width={84}>
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-3" />
            <Txt variant="meta">Run account</Txt>
          </div>
          <Txt variant="meta" tone="muted" className="mt-1">
            Shared → personal
          </Txt>
        </OnboardingAnnotation>
      )}
      {mode !== 'shared' && (
        <OnboardingAnnotation x={278} y={62} width={84}>
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-3" />
            <Txt variant="meta">You</Txt>
          </div>
        </OnboardingAnnotation>
      )}
      <OnboardingAnnotation x={38} y={193} width={84}>
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-3" />
          <Txt variant="meta">Agent</Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={158} y={193} width={84}>
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-3" />
          <Txt variant="meta">Agent</Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={278} y={193} width={84}>
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-3" />
          <Txt variant="meta">Agent</Txt>
        </div>
      </OnboardingAnnotation>
    </>
  );
}
