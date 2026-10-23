import { MeterRoot } from './meter-root';
import { MeterSource } from './meter-source';

export type { MeterProps } from './meter-root';

export const Meter = Object.assign(MeterRoot, { Source: MeterSource });
