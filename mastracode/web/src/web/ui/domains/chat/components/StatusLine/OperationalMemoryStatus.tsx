import { useChatRuntime } from '../../context/useChatRuntime';

const statusBudget = 'inline-flex items-baseline whitespace-nowrap text-icon3 tabular-nums';
const slLabel = 'mr-1 text-icon2';
const slBuffer = 'italic text-icon2';

function fmtTokensValue(n: number): string {
  if (n <= 0) return '0';
  const s = (n / 1000).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function fmtTokensThreshold(n: number): string {
  const s = (n / 1000).toFixed(1);
  return `${s.endsWith('.0') ? s.slice(0, -2) : s}k`;
}

function pctClass(percent: number): string {
  if (percent >= 90) return 'text-error';
  if (percent >= 75) return 'text-warning1';
  return 'text-icon3';
}

/**
 * Observational-memory budgets: the message window until the next observation
 * and the observations accumulated until the next reflection.
 */
export function OperationalMemoryStatus() {
  const { omProgress: om } = useChatRuntime();
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  if (!showMsg && !showMem) return null;

  return (
    <>
      {showMsg && (
        <span
          className={`${statusBudget} ${pctClass(om.thresholdPercent)}`}
          title="Message window until next observation"
        >
          <span className={slLabel}>msg</span> {fmtTokensValue(om.pendingTokens)}/{fmtTokensThreshold(om.threshold)}
          {om.projectedMessageRemoval > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om.projectedMessageRemoval)}</span>
          )}
        </span>
      )}
      {showMem && (
        <span
          className={`${statusBudget} ${pctClass(om.reflectionThresholdPercent)}`}
          title="Observations accumulated until next reflection"
        >
          <span className={slLabel}>mem</span> {fmtTokensValue(om.observationTokens)}/
          {fmtTokensThreshold(om.reflectionThreshold)}
          {om.projectedReflectionSavings > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om.projectedReflectionSavings)}</span>
          )}
        </span>
      )}
    </>
  );
}
