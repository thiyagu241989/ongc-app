export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  maximumAttempts: number,
  delaysMs: readonly number[],
  onRetry: (error: unknown, attempt: number, delayMs: number) => void
): Promise<T> {
  if (maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be at least 1");
  }

  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === maximumAttempts) {
        throw error;
      }

      const delayMs = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 0;
      onRetry(error, attempt, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Retry loop ended unexpectedly");
}