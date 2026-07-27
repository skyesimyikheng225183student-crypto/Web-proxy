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
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [url]);

  const handleIframeLoad = () => {
    onLoad();
  };

  const handleIframeError = () => {
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
    </div>
  );
};

export default BrowserFrame;