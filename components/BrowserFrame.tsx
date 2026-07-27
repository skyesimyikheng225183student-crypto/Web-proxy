'use client';

import { useState, useEffect } from 'react';
import styles from './BrowserFrame.module.css';

interface BrowserFrameProps {
  url: string;
  onLoad: () => void;
  onError: (error: string) => void;
}

const BrowserFrame = ({ url, onLoad, onError }: BrowserFrameProps) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  useEffect(() => {
    setIframeKey(prev => prev + 1);
    setLogs([`Loading ${url}...`]);
    setShowLogs(true);

    // Set 10 second timeout
    const timeout = setTimeout(() => {
      setLogs(prev => [
        ...prev,
        'ERROR: Page took too long to load (10s timeout)',
        'The website may be:',
        '- Too slow to respond',
        '- Blocked by CORS/firewall',
        '- Temporarily unavailable',
      ]);
      onError('Page load timeout - check logs below');
    }, 10000);

    setLoadTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [url, onError]);

  const handleIframeLoad = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    setLogs(prev => [...prev, 'SUCCESS: Page loaded']);
    onLoad();
  };

  const handleIframeError = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    setLogs(prev => [
      ...prev,
      'ERROR: Failed to load the website',
      'The page may be blocked or unavailable.',
    ]);
    onError('Failed to load the website. It may be blocked or unavailable.');
  };

  return (
    <div className={styles.container}>
      <div className={styles.frameHeader}>
        <div className={styles.urlBar}>
          <span className={styles.protocol}>https://</span>
          <span className={styles.domain} title={url}>
            {new URL(url).hostname}
          </span>
        </div>
        <button
          className={styles.debugToggle}
          onClick={() => setShowLogs(!showLogs)}
          aria-label={showLogs ? 'Hide debug logs' : 'Show debug logs'}
          title={showLogs ? 'Hide logs' : 'Show logs'}
        >
          🐛
        </button>
        <button
          className={styles.closeButton}
          onClick={() => window.location.reload()}
          aria-label="Reload page"
        >
          ×
        </button>
      </div>
      <iframe
        key={iframeKey}
        src={proxyUrl}
        className={styles.frame}
        title="Proxied website content"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        aria-label={`Viewing ${url}`}
      />
      {showLogs && logs.length > 0 && (
        <div className={styles.debugLogs} role="log" aria-live="polite">
          <div className={styles.logsHeader}>Debug Logs</div>
          <div className={styles.logsList}>
            {logs.map((log, idx) => (
              <div key={idx} className={styles.logLine}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowserFrame;
