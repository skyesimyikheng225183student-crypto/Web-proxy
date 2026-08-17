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
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`, { method, cache: 'no-store' });
    const duration = Math.round(performance.now() - started);
    const contentType = response.headers.get('content-type') || 'unknown';
    const text = method === 'GET' ? await response.text() : '';
    const preview = text.replace(/\s+/g, ' ').slice(0, 180);
    return {
      name,
      ok: response.ok,
      status: response.status,
      duration,
      details: [`HTTP ${response.status}`, `content-type: ${contentType}`, `bytes: ${text.length}`, preview ? `preview: ${preview}` : ''].filter(Boolean).join('\n'),
    };
  } catch (error) {
    return { name, ok: false, duration: Math.round(performance.now() - started), details: String(error) };
  }
}

export default function DevPage() {
  const [target, setTarget] = useState(DEFAULT_URL);
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [pastedLogs, setPastedLogs] = useState('');
  const [copiedResults, setCopiedResults] = useState(false);
  const [message, setMessage] = useState('');

  const tests = useMemo(() => [
    { id: 'get', name: 'Proxy GET', description: 'Fetch a normal HTML page through the real proxy route.', run: () => runProxyTest('Proxy GET', target, 'GET') },
    { id: 'head', name: 'Proxy HEAD', description: 'Check whether HEAD requests reach the upstream correctly.', run: () => runProxyTest('Proxy HEAD', target, 'HEAD') },
    { id: 'invalid', name: 'Invalid URL handling', description: 'Verify malformed target URLs return a clean 400 response.', run: () => runProxyTest('Invalid URL handling', 'not-a-valid-url', 'GET') },
    { id: 'blocked', name: 'Blocked host handling', description: 'Verify SSRF protection rejects localhost targets.', run: () => runProxyTest('Blocked host handling', 'http://127.0.0.1/', 'GET') },
  ], [target]);

  const runTest = async (id: string, testRun: () => Promise<TestResult>) => {
    setRunning(id);
    const result = await testRun();
    setResults(previous => [result, ...previous.filter(item => item.name !== result.name)]);
    setRunning(null);
    setCopiedResults(false);
  };

  const runAll = async () => {
    setRunning('all');
    const nextResults: TestResult[] = [];
    for (const test of tests) nextResults.push(await test.run());
    setResults(nextResults);
    setRunning(null);
    setCopiedResults(false);
  };

  const copyResults = async () => {
    if (!results.length) return;
    const text = results.map((result, index) => [
      `${index + 1}. ${result.ok ? 'PASS' : 'FAIL'} · ${result.name}`,
      `${result.duration} ms${result.status ? ` · HTTP ${result.status}` : ''}`,
      result.details,
    ].join('\n')).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResults(true);
      window.setTimeout(() => setCopiedResults(false), 1800);
    } catch {
      setMessage('Could not copy results. Select the results manually and copy them instead.');
    }
  };

  const pasteLogs = async () => {
    try {
      setPastedLogs(await navigator.clipboard.readText());
      setMessage('Logs pasted from clipboard.');
    } catch {
      setMessage('Clipboard paste was blocked. Paste the logs manually.');
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="dev-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Web Proxy</p>
            <h1 id="dev-title">Developer Test Panel</h1>
            <p className={styles.subtitle}>Hidden diagnostics for the real proxy route. No mock proxy logic involved.</p>
          </div>
          <div className={styles.headerActions}>
            <a className={styles.homeLink} href="/">← Back to proxy</a>
          </div>
        </div>

        <section className={styles.logImporter} aria-labelledby="log-import-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="log-import-title">Browser Debug Logs</h2>
              <p>Copy logs from the browser frame, then paste them here. This is where the detailed runtime diagnostics live.</p>
            </div>
            <div className={styles.logActions}>
              <button type="button" onClick={() => void pasteLogs()}>Paste from clipboard</button>
              <button type="button" className={styles.secondary} onClick={() => setPastedLogs('')} disabled={!pastedLogs}>Clear</button>
            </div>
          </div>
          <textarea value={pastedLogs} onChange={event => setPastedLogs(event.target.value)} placeholder={'Paste PROXY logs here…\n\nExample:\nPROXY CLICK #27 2026-08-13T08:50:28.093Z {"element":{"tag":"button"}}'} spellCheck={false} aria-label="Pasted browser debug logs" />
          <div className={styles.logMeta}>{pastedLogs ? `${pastedLogs.split(/\r?\n/).length} pasted line${pastedLogs.split(/\r?\n/).length === 1 ? '' : 's'}` : 'No pasted logs yet'}</div>
        </section>

        <div className={styles.targetBox}>
          <label htmlFor="target">Test target URL</label>
          <input id="target" value={target} onChange={event => setTarget(event.target.value)} spellCheck={false} inputMode="url" />
          <p>Used by the GET and HEAD tests. Invalid and blocked-host tests use fixed safe inputs.</p>
        </div>

        <div className={styles.actions}>
          <button onClick={() => void runAll()} disabled={running !== null}>{running === 'all' ? 'Running all…' : 'Run all tests'}</button>
          <button className={styles.secondary} onClick={() => { setResults([]); setCopiedResults(false); }} disabled={running !== null || !results.length}>Clear results</button>
        </div>

        <div className={styles.tests}>
          {tests.map(test => (
            <article className={styles.test} key={test.id}>
              <div className={styles.testInfo}><h2>{test.name}</h2><p>{test.description}</p></div>
              <button className={styles.runButton} onClick={() => void runTest(test.id, test.run)} disabled={running !== null}>{running === test.id ? 'Running…' : 'Run'}</button>
            </article>
          ))}
        </div>

        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.resultsHeader}>
            <h2 id="results-title">Results</h2>
            <div className={styles.resultsActions}>
              <span>{results.length} test{results.length === 1 ? '' : 's'}</span>
              <button type="button" onClick={() => void copyResults()} disabled={!results.length}>{copiedResults ? 'Copied!' : 'Copy results'}</button>
            </div>
          </div>
          {results.length === 0 ? <div className={styles.empty}>Run a test. The results will appear here.</div> : <div className={styles.resultList}>{results.map(result => <article className={`${styles.result} ${result.ok ? styles.pass : styles.fail}`} key={result.name}><div className={styles.resultTop}><strong>{result.ok ? 'PASS' : 'FAIL'} · {result.name}</strong><span>{result.duration} ms{result.status ? ` · HTTP ${result.status}` : ''}</span></div><pre>{result.details}</pre></article>)}</div>}
        </section>
        {message && <p className={styles.message} role="status">{message}</p>}
      </section>
    </main>
  );
}
