# Logical message identity

Harness callers may provide a `logicalMessageIdentity` with separate `input`
and `response` ids. Native preparation seeds that identity before the first
MessageList write. User-authored input rows carry the input id, while every
assistant segment in the active response carries the response id, including
segments created after response rotation. A steer may provide only its input
id; it keeps the active response owner unchanged.

The identity is serialized with MessageList state for durable recovery. Native
memory projections preserve only the validated scalar
`content.metadata.logicalMessageId`; unrelated metadata remains subject to the
existing persistence policy. Omitting the option retains the existing behavior.
