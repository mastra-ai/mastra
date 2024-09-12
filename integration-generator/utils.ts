

export function normalizeString(value: string | string[]): string[] {
	if (Array.isArray(value)) {
		return Array.from(
      new Set(
        value.map(v => {
          const normalizedName = v.replace(/[^a-zA-Z0-9\-_]/g, '');
          return normalizedName;
        }),
      ),
    )
	}
	return [value.replace(/[^a-zA-Z0-9\-_]/g, '')];
}
