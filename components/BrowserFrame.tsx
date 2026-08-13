'use client';

import { useState, useEffect } from 'react';
import styles from './BrowserFrame.module.css';

interface BrowserFrameProps {
  url: string;
  onLoad: () => void;
  onError: (error: string) => void;
}

interface ProxyDebugMessage {
  __webProxyDebug?: boolean;
  type?: string;
  seq?: number;
  time?: string;
  details?: Record<string, unknown>;
}

const BrowserFrame = ({ url, onLoad, onError }: BrowserFrameProps) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  useEffect(() => {
    const handleProxyDebug = (event: MessageEvent<ProxyDebugMessage>) => {
      if (!event.data || event.data.__webProxyDebug !== true) return;
      const details = event.data.details ? ` ${JSON.stringify(event.data.details)}` : '';
      const stamp = event.data.time ? ` ${event.data.time}` : '';
      const seq = event.data.seq != null ? ` #${event.data.seq}` : '';
      setLogs(prev => {
        const next = [...prev, `PROXY ${event.data.type || 'EVENT'}${seq}${stamp}${details}`];
        return next.length > 1000 ? next.slice(next.length - 1000) : next;
      });
    };

    window.addEventListener('message', handleProxyDebug);
    return () => window.removeEventListener('message', handleProxyDebug);
  }, []);

  useEffect(() => {
    setIframeKey(prev => prev + 1);
    setLogs([`Loading ${url}...`]);
    setShowLogs(true);

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
    return () => clearTimeout(timeout);
  }, [url, onError]);

  const handleIframeLoad = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    setLogs(prev => [...prev, 'SUCCESS: Page loaded']);
    onLoad();
  };

  const handleIframeError = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    setLogs(prev => [...prev, 'ERROR: Failed to load the website', 'The page may be blocked or unavailable.']);
    onError('Failed to load the website. It may be blocked or unavailable.');
  };

  const copyLogs = async () => {
    const text = logs.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setLogs(prev => [...prev, 'SUCCESS: Debug logs copied to clipboard']);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setLogs(prev => [...prev, 'SUCCESS: Debug logs copied to clipboard']);
      } catch {
        setLogs(prev => [...prev, 'ERROR: Clipboard access was blocked by the browser']);
      }
    }
  };

  const clearLogs = () => setLogs([`Loading ${url}...`]);

  return (
    <div className={styles.container}>
      <div className={styles.frameHeader}>
        <div className={styles.urlBar}>
          <span className={styles.protocol}>https://</span>
          <span className={styles.domain} title={url}>{new URL(url).hostname}</span>
        </div>
        <button className={styles.debugToggle} onClick={() => setShowLogs(!showLogs)} aria-label={showLogs ? 'Hide debug logs' : 'Show debug logs'} title={showLogs ? 'Hide logs' : 'Show logs'}>🐛</button>
        <button className={styles.closeButton} onClick={() => setIframeKey(prev => prev + 1)} aria-label="Reload page">×</button>
      </div>
      <iframe
        key={iframeKey}
        src={proxyUrl}
        className={styles.frame}
        title="Proxied website content"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation allow-storage-access-by-user-activation allow-downloads allow-modals allow-pointer-lock"
        allow="fullscreen; autoplay; picture-in-picture; encrypted-media; presentation; clipboard-read; clipboard-write"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        aria-label={`Viewing ${url}`}
      />
      {showLogs && logs.length > 0 && (
        <div className={styles.debugLogs} role="log" aria-live="polite">
          <div className={styles.logsHeader}>
            <span>Debug Logs ({logs.length})</span>
            <button type="button" onClick={copyLogs} aria-label="Copy debug logs">Copy</button>
            <button type="button" onClick={clearLogs} aria-label="Clear debug logs">Clear</button>
          </div>
          <div className={styles.logsList}>
            {logs.map((log, idx) => <div key={idx} className={styles.logLine}>{log}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowserFrame;
