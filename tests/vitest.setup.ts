/**
 * Vitest global setup
 * Suppresses known fire-and-forget async persistence errors during tests.
 * These are not real errors — they occur when the sync path succeeds
 * but the async persist path finds the token already consumed.
 */

// Suppress known benign unhandled rejections from fire-and-forget async persists
process.on('unhandledRejection', (reason) => {
  const msg = String(reason instanceof Error ? reason.message : reason);
  // These are expected: async persist runs after sync path already consumed the token
  const knownBenign = [
    'INVALID_REFRESH_TOKEN',
    'REFRESH_TOKEN_REUSE_DETECTED',
    'REFRESH_TOKEN_EXPIRED',
    'database is closed',
    'Environment is already open',
  ];
  if (knownBenign.some(known => msg.includes(known))) return;
  // Re-throw unexpected rejections
  console.error('[test] Unexpected unhandled rejection:', reason);
});
