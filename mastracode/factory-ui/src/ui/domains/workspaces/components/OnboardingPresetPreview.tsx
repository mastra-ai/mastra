import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, KeyRound, Sparkles, UserRound } from 'lucide-react';
import type { ModelSetupPreset } from '../services/modelSetupPreset';
import { OnboardingAnnotation } from './OnboardingAnnotation';

function ConversationPreview({ x, person }: { x: number; person: string }) {
  return (
    <OnboardingAnnotation x={x + 10} y={166} width={84}>
      <div className="flex items-center gap-2">
        <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full">
          <UserRound className="text-muted-foreground size-3" aria-hidden="true" />
        </span>
        <Txt variant="meta" tone="muted">
          {person}
        </Txt>
      </div>
      <div aria-hidden="true" className="mt-3 space-y-3">
        <div className="bg-muted/70 ml-6 rounded-lg px-2.5 py-2">
          <div className="bg-muted-foreground/15 h-1 w-4/5 rounded-full" />
        </div>
        <div className="flex items-start gap-2">
          <Sparkles className="text-muted-foreground/50 mt-0.5 size-3 shrink-0" />
          <div className="w-full space-y-1.5 pt-1">
            <div className="bg-muted h-1 w-full rounded-full" />
            <div className="bg-muted h-1 w-3/5 rounded-full" />
          </div>
        </div>
      </div>
    </OnboardingAnnotation>
  );
}

export function OnboardingPresetPreview({ preset }: { preset: ModelSetupPreset }) {
  const individual = preset.kind === 'individual';
  const personal = individual || preset.allowPersonal;
  return (
    <section aria-label="Model setup preview" className="relative h-full">
      <span className="sr-only">
        {individual
          ? 'Factory work uses the run owner’s personal account. Each teammate connects their own account for their agent sessions.'
          : personal
            ? 'The company account supplies Factory work and team sessions. Your sessions can use your own account.'
            : 'One company account supplies Factory work and everyone’s agent sessions.'}
      </span>
      <OnboardingAnnotation x={158} y={62} width={84}>
        <div className="flex items-center gap-2">
          {individual ? (
            <KeyRound className="text-muted-foreground size-3" />
          ) : (
            <Building2 className="text-muted-foreground size-3" />
          )}
          <Txt variant="meta">{individual ? 'Personal' : 'Company'}</Txt>
        </div>
      </OnboardingAnnotation>
      {individual && (
        <OnboardingAnnotation x={38} y={62} width={84}>
          <div className="flex items-center gap-2">
            <KeyRound className="text-muted-foreground size-3" />
            <Txt variant="meta">Run owner</Txt>
          </div>
        </OnboardingAnnotation>
      )}
      {personal && (
        <OnboardingAnnotation x={278} y={62} width={84}>
          <div className="flex items-center gap-2">
            <KeyRound className="text-muted-foreground size-3" />
            <Txt variant="meta">Personal</Txt>
          </div>
        </OnboardingAnnotation>
      )}
      <OnboardingAnnotation x={28} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          Factory work
        </Txt>
      </OnboardingAnnotation>
      <ConversationPreview x={148} person="Teammate" />
      <ConversationPreview x={268} person="You" />
    </section>
  );
}
