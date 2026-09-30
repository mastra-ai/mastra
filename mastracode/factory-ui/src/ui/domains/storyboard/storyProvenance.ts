import type { Actor, PersonaId, Plan, ThinkingLevel } from './cast';

export type Provenance = { payer: Actor; plan: Plan; model: string; thinking?: ThinkingLevel };

export type ProvenanceSwitch = { to: Provenance; takenBy: PersonaId | null };

export type ReplyProvenance = { ranOn: Provenance; switchedTo: ProvenanceSwitch | null };
