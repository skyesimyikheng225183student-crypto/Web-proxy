import dns from 'node:dns';
import ipaddr from 'ipaddr.js';
import type { AxiosRequestConfig } from 'axios';

export class InvalidTargetError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidTargetError'; }
}

export class SsrfBlockedError extends Error {
  constructor(message: string) { super(message); this.name = 'SsrfBlockedError'; }
}

export type ValidatedAddress = { address: string; family: 4 | 6 };
export type ResolvedTarget = { url: URL; addresses: ValidatedAddress[] };
export type LookupRecord = { address: string; family: number };
export type DnsResolver = (hostname: string) => Promise<LookupRecord[]>;

const MAX_DNS_ADDRESSES = 8;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const defaultResolver: DnsResolver = hostname =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

const stripBrackets = (hostname: string) =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

export const isPublicUnicastAddress = (parsed: ipaddr.IPv4 | ipaddr.IPv6): boolean => {
  if (parsed.kind() === 'ipv4') return parsed.range() === 'unicast';
  const v6 = parsed as ipaddr.IPv6;
  if (v6.range() === 'unicast') return true;
  if (v6.range() === 'ipv4Mapped') {
    try { return v6.toIPv4Address().range() === 'unicast'; } catch { return false; }
  }
  return false;
};

export const isSafeIpLiteral = (hostname: string): boolean => {
  const candidate = stripBrackets(hostname);
  if (!ipaddr.isValid(candidate)) return false;
  return isPublicUnicastAddress(ipaddr.parse(candidate));
};

export const parseTargetUrl = (rawUrl: string): URL => {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new InvalidTargetError('Invalid URL format'); }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new InvalidTargetError('Only HTTP and HTTPS URLs are supported');
  }
  if (!parsed.hostname) throw new InvalidTargetError('URL is missing a hostname');
  return parsed;
};

let testResolverOverride: DnsResolver | null = null;
let testAddressClassifierOverride: ((parsed: ipaddr.IPv4 | ipaddr.IPv6) => boolean) | null = null;

export const __setTestResolver = (resolver: DnsResolver | null) => { testResolverOverride = resolver; };
export const __setTestAddressClassifier = (classifier: ((parsed: ipaddr.IPv4 | ipaddr.IPv6) => boolean) | null) => {
  testAddressClassifierOverride = classifier;
};

const classifyAddress = (parsed: ipaddr.IPv4 | ipaddr.IPv6) =>
  testAddressClassifierOverride ? testAddressClassifierOverride(parsed) : isPublicUnicastAddress(parsed);

const resolveHostname = async (hostname: string, resolver: DnsResolver): Promise<LookupRecord[]> => {
  let records: LookupRecord[];
  try { records = await resolver(hostname); } catch { throw new SsrfBlockedError('Could not resolve host'); }
  if (!records?.length) throw new SsrfBlockedError('Could not resolve host');
  if (records.length > MAX_DNS_ADDRESSES) {
    throw new SsrfBlockedError('Host resolves to too many addresses to validate safely');
  }
  return records;
};

export const guardTarget = async (
  rawUrl: string,
  resolver: DnsResolver = testResolverOverride ?? defaultResolver,
): Promise<ResolvedTarget> => {
  const url = parseTargetUrl(rawUrl);
  const literal = stripBrackets(url.hostname);

  if (ipaddr.isValid(literal)) {
    const parsed = ipaddr.parse(literal);
    if (!classifyAddress(parsed)) throw new SsrfBlockedError('Access to this address is not allowed');
    return { url, addresses: [{ address: literal, family: parsed.kind() === 'ipv6' ? 6 : 4 }] };
  }

  const records = await resolveHostname(url.hostname, resolver);
  for (const record of records) {
    let parsed: ipaddr.IPv4 | ipaddr.IPv6;
    try { parsed = ipaddr.parse(record.address); } catch { throw new SsrfBlockedError('Access to this domain is not allowed'); }
    if (!classifyAddress(parsed)) throw new SsrfBlockedError('Access to this domain is not allowed');
  }

  return {
    url,
    addresses: records.map(record => ({ address: record.address, family: record.family === 6 ? 6 : 4 })),
  };
};

type PinnedLookup = NonNullable<AxiosRequestConfig['lookup']>;

export const createPinnedLookup = (target: ValidatedAddress): PinnedLookup => {
  const lookup = (
    _hostname: string,
    options: dns.LookupOptions | ((...args: unknown[]) => void),
    callback?: (...args: unknown[]) => void,
  ): void => {
    const resolvedCallback = typeof options === 'function' ? options : callback;
    const resolvedOptions = typeof options === 'function' ? undefined : options;
    if (!resolvedCallback) return;
    if (resolvedOptions && resolvedOptions.all) {
      resolvedCallback(null, [{ address: target.address, family: target.family }]);
    } else {
      resolvedCallback(null, target.address, target.family);
    }
  };
  return lookup as PinnedLookup;
};

export const isMethodDowngradingRedirect = (status: number) =>
  status === 301 || status === 302 || status === 303;

export const isRedirectStatus = (status: number) =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
