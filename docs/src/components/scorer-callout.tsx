import { Callout } from "nextra/components";

export const ScorerCallout = () => {
  return (
    <Callout type="info">
      <b>New Scorer API</b>
      <p>
        We just released a new evals API called Scorers, with a more ergonomic
        API and more metadata stored for error analysis, and more flexibility to
        evaluate data structures. It’s fairly simple to migrate, but we will
        continue to support the existing Evals API.
      </p>
    </Callout>
  );
};
