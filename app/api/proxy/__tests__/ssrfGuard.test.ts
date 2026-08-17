import test from 'node:test';
import assert from 'node:assert/strict';
import ipaddr from 'ipaddr.js';
import {
  guardTarget,
  isSafeIpLiteral,
  isPublicUnicastAddress,
  parseTargetUrl,
  createPinnedLookup,
  isRedirectStatus,
  isMethodDowngradingRedirect,
  InvalidTargetError,
  SsrfBlockedError,
  type DnsResolver,
} from '../ssrfGuard';

const fakeResolver = (records: { address: string; family: number }[]): DnsResolver => async () => records;

test('accepts a public DNS target and preserves URL details', async () => {
  const result = await guardTarget('https://example.com:8443/path?x=1&y=2', fakeResolver([{ address: '93.184.216.34', family: 4 }]));
  assert.equal(result.url.hostname, 'example.com');
  assert.equal(result.url.port, '8443');
  assert.equal(result.url.pathname, '/path');
  assert.equal(result.url.search, '?x=1&y=2');
  assert.deepEqual(result.addresses, [{ address: '93.184.216.34', family: 4 }]);
});

test('blocks private DNS answers', async () => {
  await assert.rejects(
    guardTarget('https://example.com/', fakeResolver([{ address: '192.168.1.10', family: 4 }])),
    SsrfBlockedError,
  );
});

test('blocks a mixed public/private DNS answer set', async () => {
  await assert.rejects(
    guardTarget('https://example.com/', fakeResolver([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ])),
    SsrfBlockedError,
  );
});

test('blocks private IP literals and accepts public IP literals', async () => {
  assert.equal(isSafeIpLiteral('8.8.8.8'), true);
  assert.equal(isSafeIpLiteral('127.0.0.1'), false);
  assert.equal(isSafeIpLiteral('::1'), false);
  assert.equal(isSafeIpLiteral('2001:4860:4860::8888'), true);
  await assert.rejects(guardTarget('http://127.0.0.1/'), SsrfBlockedError);
});

test('blocks IPv4-mapped loopback and accepts mapped public IPv4', async () => {
  assert.equal(isSafeIpLiteral('::ffff:127.0.0.1'), false);
  assert.equal(isSafeIpLiteral('::ffff:8.8.8.8'), true);
});

test('rejects malformed and non-http protocols', () => {
  assert.throws(() => parseTargetUrl('not a url'), InvalidTargetError);
  assert.throws(() => parseTargetUrl('ftp://example.com/file'), InvalidTargetError);
});

test('rejects oversized DNS answer sets', async () => {
  const records = Array.from({ length: 9 }, (_, i) => ({ address: `93.184.216.${i + 1}`, family: 4 }));
  await assert.rejects(guardTarget('https://example.com/', fakeResolver(records)), SsrfBlockedError);
});

test('redirect helpers match HTTP semantics', () => {
  assert.equal(isRedirectStatus(301), true);
  assert.equal(isRedirectStatus(308), true);
  assert.equal(isRedirectStatus(200), false);
  assert.equal(isMethodDowngradingRedirect(301), true);
  assert.equal(isMethodDowngradingRedirect(303), true);
  assert.equal(isMethodDowngradingRedirect(307), false);
});

test('pinned lookup never performs another DNS lookup', async () => {
  const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
  const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
    lookup('attacker-controlled.example', {}, (error: unknown, address: unknown, family: unknown) => {
      if (error) return reject(error);
      resolve({ address: String(address), family: Number(family) });
    });
  });
  assert.deepEqual(result, { address: '93.184.216.34', family: 4 });
});

test('public address classifier agrees with ipaddr.js for known public addresses', () => {
  for (const ip of ['1.1.1.1', '8.8.4.4', '2001:4860:4860::8888']) {
    assert.equal(isPublicUnicastAddress(ipaddr.parse(ip)), true, ip);
  }
});
