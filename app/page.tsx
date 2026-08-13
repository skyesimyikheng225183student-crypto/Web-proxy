'use client';

import { useState } from 'react';
import ProxyForm from '@/components/ProxyForm';
import BrowserFrame from '@/components/BrowserFrame';
import styles from './page.module.css';

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleProxyRequest = async (targetUrl: string) => {
    setUrl(targetUrl);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleLoad = () => {
    // Silent success - logs stay in BrowserFrame component
  };

  return (
    <div className={styles.container}>
      <header className={styles.header} role="banner">
        <div>
          <h1>Web Proxy test</h1>
          <p>currently testin, dont expect much.</p>
        </div>
        <a
          href="/dev"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.65rem 1rem',
            borderRadius: '0.6rem',
            textDecoration: 'none',
            fontWeight: 600,
            border: '1px solid currentColor',
          }}
        >
          Developer Panel
        </a>
      </header>

      <main className={styles.main} role="main">
        <ProxyForm onRequest={handleProxyRequest} />

        {error && (
          <div className={styles.error} role="alert" aria-live="polite" aria-atomic="true">
            <strong>Error:</strong> {error}
          </div>
        )}

        {url && (
          <BrowserFrame url={url} onLoad={handleLoad} onError={handleError} />
        )}
      </main>

      <footer className={styles.footer} role="contentinfo">
        <p>made for apple, may not work elsewhere, idk tbh.</p>
      </footer>
    </div>
  );
}
