const AVG_CHARS_PER_TOKEN = 4;

export function estimateTokens(value: unknown): number {
  const text = stringifySafe(value);
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

export function stringifySafe(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
