import type { WorkflowStepCardViewProps } from '../../types';
import { TimeDial } from './workflow-time-dial';
import './workflow-timing.css';

function durationReading(duration: number): { amount: number; unit: 'ms' | 's' | 'min' | 'h' } {
  if (duration < 1000) return { amount: duration, unit: 'ms' };
  if (duration < 60000) return { amount: duration / 1000, unit: 's' };
  if (duration < 3600000) return { amount: duration / 60000, unit: 'min' };
  return { amount: duration / 3600000, unit: 'h' };
}

export function WorkflowTiming({ duration, date }: Pick<WorkflowStepCardViewProps, 'duration' | 'date'>) {
  if (date) {
    const scheduled = new Date(date);
    if (!Number.isFinite(scheduled.getTime())) {
      return <span className="workflow-timing-caption">Schedule unavailable</span>;
    }
    return (
      <span className="workflow-timing">
        <span className="workflow-timing-reading">
          <span className="workflow-timing-value">
            {scheduled.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })}
            <small>UTC</small>
          </span>
          <span className="workflow-timing-caption">
            {scheduled.toLocaleDateString('en-GB', {
              timeZone: 'UTC',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </span>
        <TimeDial date={scheduled} amount={0} unit="s" />
      </span>
    );
  }
  if (duration === undefined) return null;
  if (!Number.isFinite(duration) || duration < 0) {
    return <span className="workflow-timing-caption">Delay unavailable</span>;
  }
  const reading = durationReading(duration);
  return (
    <span className="workflow-timing">
      <span className="workflow-timing-reading">
        <span className="workflow-timing-value">
          {reading.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })}
          <small>{reading.unit}</small>
        </span>
        <span className="workflow-timing-caption">Configured delay</span>
      </span>
      <TimeDial {...reading} />
    </span>
  );
}
