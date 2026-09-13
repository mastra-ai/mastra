# Logical message identity

Harness callers may provide a `logicalMessageIdentity` with separate `input`
and `response` ids. Native preparation seeds that identity before the first
MessageList write. User-authored input rows carry the input id, while every
assistant segment in the active response carries the response id, including
segments created after response rotation. A steer may provide only its input
id; it keeps the active response owner unchanged.

Only the constructor-created list's first input batch gives unmarked signal
rows the active input id. That one-time admission state is serialized with the
list, so trimming the initial rows cannot make a later unlineaged steer look
like the original input. Signals admitted independently may carry their own
validated input id; recalled memory rows keep their existing ownership.

The identity is serialized with MessageList state for durable recovery. Native
memory projections preserve only the validated scalar
`content.metadata.logicalMessageId`; unrelated metadata remains subject to the
existing persistence policy. Final-turn persistence projects an admitted signal
to an ordinary user row after removing its signal envelope. Omitting the option
retains the existing behavior.
