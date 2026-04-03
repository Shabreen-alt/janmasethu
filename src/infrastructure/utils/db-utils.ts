import { Logger } from '@nestjs/common';

const logger = new Logger('DbUtils');

/**
 * Executes a Supabase or async operation with exponential backoff retry.
 * Specifically handles transient network errors or database overload (5xx, 429).
 */
export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<{ data: T | null; error: any }> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await operation();
    
    if (!result.error) {
      return result;
    }

    lastError = result.error;
    
    // Only retry on transient errors (5xx, 429, or network disconnects)
    const status = lastError?.status;
    const isRetryable = status === 429 || (status >= 500 && status < 600) || !status;

    if (!isRetryable) {
      return result; // Don't retry client-side errors (400, 401, 403, 404)
    }

    const delay = baseDelayMs * Math.pow(2, attempt);
    logger.warn(`Database operation failed (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms... Error: ${lastError.message}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return { data: null, error: lastError };
}
