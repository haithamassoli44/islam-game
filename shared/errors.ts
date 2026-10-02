export function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'data' in error ? String(error.data) : String(error);
}
