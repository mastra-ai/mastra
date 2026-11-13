/** How a signed-in user is named in the UI: their name, else their email; undefined when they have neither. */
export function accountName(user: { name?: string; email?: string } | undefined): string | undefined {
  const name = user?.name?.trim();
  if (name) return name;
  return user?.email || undefined;
}
