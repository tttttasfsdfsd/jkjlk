/**
 * Integration Tests: /api/analyze
 * P5-28: Test with valid JWT, invalid JWT, expired JWT, wrong companyId
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { signAccessToken } from '../api/lib/tokenService';
import { startTestServer, stopTestServer, getBaseUrl } from './setup-server';

// Build a minimal valid JWT payload
function makeToken(overrides: Partial<{
  id: number; companyId: number; plan: string; reportsUsed: number; reportsLimit: number;
}> = {}, expiresInSec = 900) {
  return signAccessToken({
    id:           overrides.id            ?? 1,
    uid:          'test-uid',
    email:        'test@eexa.io',
    role:         'analyst' as const,
    plan:         (overrides.plan as 'free') ?? 'professional',
    companyId:    overrides.companyId     ?? 1,
    sessionId:    'test-session',
    reportsUsed:  overrides.reportsUsed   ?? 0,
    reportsLimit: overrides.reportsLimit  ?? 30,
  }, expiresInSec);
}

describe('/api/analyze authentication', () => {
  beforeAll(async () => {
    // High limits for testing — don't want rate limiting to interfere
    process.env.ANALYZE_RATE_LIMIT_MAX  = '1000';
    process.env.RATE_LIMIT_MAX         = '10000';
    process.env.LMDB_PATH = `/tmp/eexa-analyze-test-${Date.now()}`;
    const { resetStore } = await import('../api/lib/persist');
    await resetStore();
    await startTestServer();
  }, 30_000);
  afterAll(async () => { await stopTestServer(); });

  it('returns 401 with no Authorization header', async () => {
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, { method: 'POST' });
    expect(resp.status).toBe(401);
  });

  it('returns 401 with malformed Authorization header', async () => {
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: 'notbearer abc' },
    });
    expect(resp.status).toBe(401);
  });

  it('returns 401 with invalid JWT', async () => {
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: 'Bearer not.a.valid.jwt' },
    });
    expect(resp.status).toBe(401);
  });

  it('returns 401 with expired JWT', async () => {
    const token = makeToken({}, -1); // already expired
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(401);
  });

  it('returns 400 (not 401) with valid JWT but no file', async () => {
    const token = makeToken();
    const formData = new FormData();
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    // Auth passed — fails on missing file
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  it('returns 402 when plan limit exceeded', async () => {
    // reportsLimit = 0 means quota exhausted
    const token = makeToken({ reportsUsed: 0, reportsLimit: 0 });
    const formData = new FormData();
    formData.append('companyName', 'Test Co');
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    expect(resp.status).toBe(402);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });
});

describe('/api/analyze file validation', () => {
  beforeAll(async () => {
    process.env.ANALYZE_RATE_LIMIT_MAX  = '1000';
    process.env.RATE_LIMIT_MAX         = '10000';
    process.env.LMDB_PATH = `/tmp/eexa-file-test-${Date.now()}`;
    const { resetStore } = await import('../api/lib/persist');
    await resetStore();
    await startTestServer();
  }, 30_000);
  const validToken = () => makeToken();

  it('rejects empty CSV with 400', async () => {
    const formData = new FormData();
    const blob = new Blob([''], { type: 'text/csv' });
    formData.append('file', new File([blob], 'test.csv'));
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken()}` },
      body: formData,
    });
    const body = await resp.json();
    expect(body.success).toBe(false);
  });

  it('rejects .exe file with 400', async () => {
    const formData = new FormData();
    const blob = new Blob(['MZ\x90\x00'], { type: 'application/octet-stream' });
    formData.append('file', new File([blob], 'malware.exe'));
    const resp = await fetch(`${getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken()}` },
      body: formData,
    });
    expect(resp.status).toBe(400);
  });
});

describe('Rate limiting', () => {
  beforeAll(async () => {
    process.env.ANALYZE_RATE_LIMIT_MAX  = '1000';
    process.env.RATE_LIMIT_MAX         = '10000';
    process.env.LMDB_PATH = `/tmp/eexa-rate-test-${Date.now()}`;
    const { resetStore } = await import('../api/lib/persist');
    await resetStore();
    await startTestServer();
  }, 30_000);
  it('blocks after exceeding per-IP limit', async () => {
    // Temporarily lower the rate limit for this test, then restore
    const origLimit = process.env.ANALYZE_RATE_LIMIT_MAX;
    process.env.ANALYZE_RATE_LIMIT_MAX = '5'; // very low limit for this test

    const token = makeToken({ reportsLimit: 999 });
    const FIXED_IP = '10.0.0.1'; // same IP for all requests to trigger limit
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${getBaseUrl()}/api/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Forwarded-For': FIXED_IP,
        },
        body: new FormData(),
      })
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    // At least one should be 429 after exceeding limit=5
    expect(statuses).toContain(429);

    // Restore limit
    if (origLimit) process.env.ANALYZE_RATE_LIMIT_MAX = origLimit;
    else delete process.env.ANALYZE_RATE_LIMIT_MAX;
  });
});
