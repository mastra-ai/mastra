/**
 * Id of the error message for a field, so a control can point at its message with
 * `aria-describedby`. Lives apart from the component file: exporting it alongside a
 * component breaks fast refresh.
 */
export const fieldErrorId = (name: string) => `error-${name}`;
