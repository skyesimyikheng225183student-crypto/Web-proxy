'use client';

import Link from 'next/link';
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

const EFFECT_DURATION: Record<EasterEgg, number> = {
  terminal: 3000,
  glitch: 1800,
  retro: 3000,
  barrelRoll: 1100,
};

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeEggs, setActiveEggs] = useState<EasterEgg[]>([]);
  const [easterEggCombo, setEasterEggCombo] = useState(false);
  const [discoveredEggs, setDiscoveredEggs] = useState<EasterEgg[]>([]);

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
    setDiscoveredEggs(discovered);
    setActiveEggs((current) => [...current.filter((item) => item !== egg), egg]);

    window.setTimeout(() => {
      setActiveEggs((current) => current.filter((item) => item !== egg));
    }, EFFECT_DURATION[egg]);

    if (allCoreEasterEggsDiscovered(discovered)) {
      setEasterEggCombo(true);
      setActiveEggs(['terminal', 'glitch', 'retro', 'barrelRoll']);
      window.setTimeout(() => {
        setEasterEggCombo(false);
        setActiveEggs([]);
      }, 2600);
    }
  };

  const handleSpecialInput = (value: string): boolean => {
    const egg = findEasterEgg(value);
    if (!egg) return false;
    triggerEasterEgg(egg);
    return true;
  };

  useEffect(() => {
    setDiscoveredEggs(getDiscoveredEasterEggs());
  }, []);

  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const beta = Math.abs(event.beta ?? 0);
      const gamma = Math.abs(event.gamma ?? 0);
      if (beta > 140 || gamma > 140) triggerEasterEgg('barrelRoll');
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    return () => window.removeEventListener('deviceorientation', handleDeviceOrientation);
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
      data-easter-eggs-discovered={discoveredEggs.length}
    >
      <header className={styles.header} role="banner">
        <Link href="/settings" className={styles.settingsButton} aria-label="Open settings">
          ⚙
        </Link>
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
