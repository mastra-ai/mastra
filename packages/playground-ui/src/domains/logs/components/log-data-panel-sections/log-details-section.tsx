import type { LogRecord } from '../../types';
import { LogInsetSection } from './log-inset-section';
import { logLevelTextClass } from '@/ds/components/LogStream';
import { cn } from '@/lib/utils';

export function LogDetailsSection({ log }: { log: LogRecord }) {
  return (
    <LogInsetSection title="Details">
      <LogInsetSection.Row label="Level">
        <span className={cn('capitalize', logLevelTextClass[log.level])}>{log.level}</span>
      </LogInsetSection.Row>
      {log.entityType && <LogInsetSection.Row label="Entity type">{log.entityType}</LogInsetSection.Row>}
      {log.entityName && <LogInsetSection.Row label="Entity name">{log.entityName}</LogInsetSection.Row>}
      {log.serviceName && <LogInsetSection.Row label="Service">{log.serviceName}</LogInsetSection.Row>}
      {log.environment && <LogInsetSection.Row label="Environment">{log.environment}</LogInsetSection.Row>}
      {log.source && <LogInsetSection.Row label="Source">{log.source}</LogInsetSection.Row>}
    </LogInsetSection>
  );
}
