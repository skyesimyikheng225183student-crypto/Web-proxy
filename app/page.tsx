'use client';

import { useState } from 'react';
import ProxyForm from '@/components/ProxyForm';
import BrowserFrame from '@/components/BrowserFrame';
import styles from './page.module.css';

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const handleProxyRequest = async (targetUrl: string) => {
    setUrl(targetUrl);
    setIsLoading(true);
    setError('');
    setDebugLogs([`Requesting: ${targetUrl}`]);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
    setDebugLogs(prev => [...prev, `ERROR: ${errorMessage}`]);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setDebugLogs(prev => [...prev, 'SUCCESS: Page loaded']);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header} role="banner">
        <h1>Web Proxy</h1>
        <p>Access websites freely and securely</p>
      </header>

      <main className={styles.main} role="main">
        <ProxyForm onRequest={handleProxyRequest} />

        {debugLogs.length > 0 && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '0.5rem',
              border: '1px solid #ddd',
              maxHeight: '150px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
          >
            <strong>Debug Logs:</strong>
            {debugLogs.map((log, idx) => (
              <div key={idx} style={{ color: log.includes('ERROR') ? '#d32f2f' : '#000' }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            className={styles.error}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && (
          <div className={styles.loading} role="status" aria-live="polite">
            <div className={styles.spinner}></div>
            <p>Loading...</p>
          </div>
        )}

        {url && !isLoading && (
          <BrowserFrame
            url={url}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </main>

      <footer className={styles.footer} role="contentinfo">
        <p>
          Made with accessibility in mind. Compatible with iOS Safari and screen readers.
        </p>
      </footer>
    </div>
  );
}
