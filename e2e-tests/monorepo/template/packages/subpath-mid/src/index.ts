// Both imports reach @inner/subpath-only through a *subpath*, from the source of another
// workspace package. Transitive-dependency discovery is manifest-name based, so these
// specifiers are never captured by the analyze step - they have to be resolved at bundle time.
// The first goes through a static exports entry, the second through a wildcard one.
import { greeting } from '@inner/subpath-only/greeting';
import { counted } from '@inner/subpath-only/sub/counter';

export const midValue = `${greeting} + ${counted}`;
