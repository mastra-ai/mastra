// Browser-safe leaf, exported through ../contract.ts. Keep it free of imports:
// storage, Node and the code SDK depend on it, not the other way round (see contract.test.ts).

/**
 * What a phase means to the runtime.
 * - `resting`: nobody is seated; a card waits for a person or an event.
 * - `working`: an agent in the phase's context carries the card; a person's move in arms autonomy.
 * - `terminal`: the card is finished; sessions stop and held resources are released.
 */
export type BoardPhaseKind = 'resting' | 'working' | 'terminal';
