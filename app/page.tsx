'use client';

import { useEffect, useState } from 'react';
import ProxyForm from '@/components/ProxyForm';
import BrowserFrame from '@/components/BrowserFrame';
import styles from './page.module.css';
import {
  allCoreEasterEggsDiscovered,
  discoverEasterEgg,
  findEasterEgg,
  getDiscoveredEasterEggs,
  type EasterEgg,
} from '@/lib/easterEggs';

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeEggs, setActiveEggs] = useState<EasterEgg[]>([]);
  const [easterEggCombo, setEasterEggCombo] = useState(false);

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

  const triggerEasterEgg = (egg: EasterEgg) => {
    const discovered = discoverEasterEgg(egg);
    setActiveEggs((current) => [...current.filter((item) => item !== egg), egg]);

    if (allCoreEasterEggsDiscovered(discovered)) {
      setEasterEggCombo(true);
      window.setTimeout(() => setEasterEggCombo(false), 2600);
    }
  };

  const handleSpecialInput = (value: string): boolean => {
    const egg = findEasterEgg(value);
    if (!egg) return false;
    triggerEasterEgg(egg);
    return true;
  };

  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const beta = Math.abs(event.beta ?? 0);
      const gamma = Math.abs(event.gamma ?? 0);
      if (beta > 140 || gamma > 140) triggerEasterEgg('barrelRoll');
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    return () => window.removeEventListener('deviceorientation', handleDeviceOrientation);
  }, []);

  useEffect(() => {
    const discovered = getDiscoveredEasterEggs();
    if (discovered.length) setActiveEggs(discovered);
  }, []);

  return (
    <div
      className={[
        styles.container,
        activeEggs.includes('terminal') ? 'egg-terminal' : '',
        activeEggs.includes('glitch') ? 'egg-glitch' : '',
        activeEggs.includes('retro') ? 'egg-retro' : '',
        activeEggs.includes('barrelRoll') ? 'egg-barrel-roll' : '',
        easterEggCombo ? 'egg-shatter-combo' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className={styles.header} role="banner">
        <div className={styles.headerTitle}>
          <h1>Web Proxy test</h1>
          <p>currently testin, dont expect much.</p>
        </div>
        <a className={styles.devButton} href="/dev">
          Developer Panel
        </a>
      </header>

      <main className={styles.main} role="main">
        <ProxyForm onRequest={handleProxyRequest} onSpecialInput={handleSpecialInput} />

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
