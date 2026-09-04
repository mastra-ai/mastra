import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { focusRing, transitions } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Building2, CircleUserRound, Server, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type SettingsScope = 'personal' | 'factory' | 'org' | 'deployment';

export type ScopeControl = {
  value: SettingsScope;
  options: readonly SettingsScope[];
  onChange: (scope: SettingsScope) => void;
};

const SCOPE_BADGE: Record<SettingsScope, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  personal: { label: 'Personal', variant: 'neutral', icon: CircleUserRound },
  factory: { label: 'Factory-wide', variant: 'blue', icon: Building2 },
  org: { label: 'Org-wide', variant: 'blue', icon: Users },
  deployment: { label: 'Deployment-wide', variant: 'blue', icon: Server },
};

export function ScopeBadge({ scope }: { scope: SettingsScope }) {
  const { label, variant, icon: Icon } = SCOPE_BADGE[scope];
  return (
    <Badge size="sm" variant={variant} icon={<Icon aria-hidden="true" />}>
      {label}
    </Badge>
  );
}

export function ScopeSwitch({ value, options, onChange }: ScopeControl) {
  return (
    <div
      role="group"
      aria-label="Who these settings apply to"
      className="border-border1 inline-flex items-center gap-0.5 rounded-[9px] border p-0.5"
    >
      {options.map(scope => {
        const { label, icon: Icon } = SCOPE_BADGE[scope];
        const selected = scope === value;
        return (
          <button
            key={scope}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(scope)}
            className={cn(
              'text-icon3 hover:text-icon5 inline-flex h-5 cursor-pointer items-center rounded-[7px] outline-none',
              focusRing.visible,
              transitions.colors,
            )}
          >
            {selected ? (
              <ScopeBadge scope={scope} />
            ) : (
              <span className="text-ui-xs inline-flex h-5 items-center gap-1 px-1.5 font-medium">
                <Icon aria-hidden="true" className="h-icon-sm w-icon-sm" />
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const SLIDE_PX = 8;

function animate(element: HTMLElement | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (!element || typeof element.animate !== 'function' || reducedMotion()) return null;
  element.getAnimations().forEach(running => running.cancel());
  return element.animate(keyframes, options);
}

export type ScopeSwapControl = ScopeControl & { shown: SettingsScope; bodyRef: RefObject<HTMLDivElement | null> };

/** `value` follows the switch at once; `shown` follows once the current body has slid out, so render the body from `shown` inside `ScopeSwap`. */
export function useScopeControl(
  options: readonly SettingsScope[],
  initial: SettingsScope = 'personal',
): ScopeSwapControl {
  const [picked, setPicked] = useState(initial);
  const [revealed, setRevealed] = useState(initial);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Options shrink when a permission answer lands, so a scope picked while the
  // answer was pending falls back rather than editing a scope no longer offered.
  const offered = (scope: SettingsScope) => (options.includes(scope) ? scope : (options[0] ?? initial));
  const value = offered(picked);
  const shown = offered(revealed);

  const onChange = (next: SettingsScope) => {
    if (next === value) return;
    setPicked(next);
    const dx = options.indexOf(next) > options.indexOf(value) ? SLIDE_PX : -SLIDE_PX;
    const exit = animate(
      bodyRef.current,
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translateX(${-dx}px)` },
      ],
      { duration: 120, easing: 'ease-in', fill: 'forwards' },
    );
    if (!exit) return setRevealed(next);
    exit.finished.then(
      () => {
        flushSync(() => setRevealed(next));
        animate(
          bodyRef.current,
          [
            { opacity: 0, transform: `translateX(${dx}px)` },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 200, easing: 'ease-out' },
        );
      },
      () => {},
    );
  };

  return { value, shown, options, onChange, bodyRef };
}

/** Clips the slide horizontally: a translate on a full-width body widens the page, and every scrollable ancestor answers with a scrollbar. */
export function ScopeSwap({ control, children }: { control: ScopeSwapControl; children: ReactNode }) {
  return (
    <div className="overflow-x-clip">
      <div ref={control.bodyRef}>{children}</div>
    </div>
  );
}
