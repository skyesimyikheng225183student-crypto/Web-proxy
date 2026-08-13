'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';

type TestResult = {
  name: string;
  ok: boolean;
  status?: number;
  duration: number;
  details: string;
};

const DEFAULT_URL = 'https://example.com/';

async function runProxyTest(name: string, target: string, method: 'GET' | 'HEAD' = 'GET'): Promise<TestResult> {
  const started = performance.now();
  try {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`, {
      method,
      cache: 'no-store',
    });
    const duration = Math.round(performance.now() - started);
    const contentType = response.headers.get('content-type') || 'unknown';
    const text = method === 'GET' ? await response.text() : '';
    const preview = text.replace(/\s+/g, ' ').slice(0, 180);

    return {
      name,
      ok: response.ok,
      status: response.status,
      duration,
      details: [
        `HTTP ${response.status}`,
        `content-type: ${contentType}`,
        `bytes: ${text.length}`,
        preview ? `preview: ${preview}` : '',
      ].filter(Boolean).join('\n'),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      duration: Math.round(performance.now() - started),
      details: String(error),
    };
  }
}

export default function DevPage() {
  const [target, setTarget] = useState(DEFAULT_URL);
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const tests = useMemo(() => [
    {
      id: 'get',
      name: 'Proxy GET',
      description: 'Fetch a normal HTML page through the real proxy route.',
      run: () => runProxyTest('Proxy GET', target, 'GET'),
    },
    {
      id: 'head',
      name: 'Proxy HEAD',
      description: 'Check whether HEAD requests reach the upstream correctly.',
      run: () => runProxyTest('Proxy HEAD', target, 'HEAD'),
    },
    {
      id: 'invalid',
      name: 'Invalid URL handling',
      description: 'Verify malformed target URLs return a clean 400 response.',
      run: () => runProxyTest('Invalid URL handling', 'not-a-valid-url', 'GET'),
    },
    {
      id: 'blocked',
      name: 'Blocked host handling',
      description: 'Verify SSRF protection rejects localhost targets.',
      run: () => runProxyTest('Blocked host handling', 'http://127.0.0.1/', 'GET'),
    },
  ], [target]);

  const runTest = async (id: string, testRun: () => Promise<TestResult>) => {
    setRunning(id);
    const result = await testRun();
    setResults(previous => [result, ...previous.filter(item => item.name !== result.name)]);
    setRunning(null);
  };

  const runAll = async () => {
    setRunning('all');
    const nextResults: TestResult[] = [];
    for (const test of tests) nextResults.push(await test.run());
    setResults(nextResults);
    setRunning(null);
  };

  const clearResults = () => setResults([]);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="dev-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Web Proxy</p>
            <h1 id="dev-title">Developer Test Panel</h1>
            <p className={styles.subtitle}>
              Small, repeatable tests for the real proxy route. No mock proxy logic involved.
            </p>
          </div>
          <a className={styles.homeLink} href="/">← Back to proxy</a>
        </div>

        <div className={styles.targetBox}>
          <label htmlFor="target">Test target URL</label>
          <input
            id="target"
            value={target}
            onChange={event => setTarget(event.target.value)}
            spellCheck={false}
            inputMode="url"
          />
          <p>Used by the GET and HEAD tests. The invalid and blocked-host tests use fixed safe test inputs.</p>
        </div>

        <div className={styles.actions}>
          <button onClick={runAll} disabled={running !== null}>
            {running === 'all' ? 'Running all…' : 'Run all tests'}
          </button>
          <button className={styles.secondary} onClick={clearResults} disabled={running !== null || results.length === 0}>
            Clear results
          </button>
        </div>

        <div className={styles.tests}>
          {tests.map(test => (
            <article className={styles.test} key={test.id}>
              <div className={styles.testInfo}>
                <h2>{test.name}</h2>
                <p>{test.description}</p>
              </div>
              <button
                className={styles.runButton}
                onClick={() => runTest(test.id, test.run)}
                disabled={running !== null}
              >
                {running === test.id ? 'Running…' : 'Run'}
              </button>
            </article>
          ))}
        </div>

        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.resultsHeader}>
            <h2 id="results-title">Results</h2>
            <span>{results.length} test{results.length === 1 ? '' : 's'}</span>
          </div>

          {results.length === 0 ? (
            <div className={styles.empty}>Run a test. The results will appear here.</div>
          ) : (
            <div className={styles.resultList}>
              {results.map(result => (
                <article className={`${styles.result} ${result.ok ? styles.pass : styles.fail}`} key={result.name}>
                  <div className={styles.resultTop}>
                    <strong>{result.ok ? 'PASS' : 'FAIL'} · {result.name}</strong>
                    <span>{result.duration} ms{result.status ? ` · HTTP ${result.status}` : ''}</span>
                  </div>
                  <pre>{result.details}</pre>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
