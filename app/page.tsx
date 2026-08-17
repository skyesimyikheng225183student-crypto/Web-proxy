'use client';

import { FormEvent, useEffect, useState } from 'react';
import ProxyForm from '@/components/ProxyForm';
import BrowserFrame from '@/components/BrowserFrame';
import styles from './page.module.css';
import {
  allCoreEasterEggsDiscovered,
  discoverEasterEgg,
  EASTER_EGG_CODES,
  findEasterEgg,
  getDiscoveredEasterEggs,
  type EasterEgg,
} from '@/lib/easterEggs';

const EFFECT_DURATION: Record<EasterEgg, number> = {
  terminal: 3000,
  glitch: 1800,
  retro: 3000,
  barrelRoll: 1100,
  doAFlip: 1100,
};

const EGG_LABELS: Record<EasterEgg, string> = {
  terminal: 'Terminal',
  glitch: 'Glitch',
  retro: 'Retro',
  barrelRoll: 'Barrel Roll',
  doAFlip: 'Do a Flip',
};

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeEggs, setActiveEggs] = useState<EasterEgg[]>([]);
  const [easterEggCombo, setEasterEggCombo] = useState(false);
  const [discoveredEggs, setDiscoveredEggs] = useState<EasterEgg[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const handleProxyRequest = async (targetUrl: string) => {
    setUrl(targetUrl);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleLoad = () => {};

  const triggerEasterEgg = (egg: EasterEgg) => {
    const discovered = discoverEasterEgg(egg);
    setDiscoveredEggs(discovered);
    setActiveEggs((current) => [...current.filter((item) => item !== egg), egg]);

    window.setTimeout(() => {
      setActiveEggs((current) => current.filter((item) => item !== egg));
    }, EFFECT_DURATION[egg]);

    if (allCoreEasterEggsDiscovered(discovered)) {
      setEasterEggCombo(true);
      setActiveEggs(['terminal', 'glitch', 'retro', 'barrelRoll', 'doAFlip']);
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

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const egg = findEasterEgg(code);

    if (!egg) {
      setSettingsMessage('That code did not work.');
      return;
    }

    triggerEasterEgg(egg);
    setCode('');
    setSettingsMessage(`${EGG_LABELS[egg]} effect discovered.`);
  };

  const clearDiscoveries = () => {
    try {
      window.localStorage.removeItem('web-proxy-easter-eggs');
    } catch {}
    setDiscoveredEggs([]);
    setSettingsMessage('Easter egg discoveries cleared.');
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
        activeEggs.includes('doAFlip') ? 'egg-do-a-flip' : '',
        easterEggCombo ? 'egg-shatter-combo' : '',
      ].filter(Boolean).join(' ')}
      data-easter-eggs-discovered={discoveredEggs.length}
    >
      <header className={styles.header} role="banner">
        <button type="button" className={styles.settingsButton} aria-label="Open settings" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen((open) => !open); setSettingsMessage(''); }}>
          ⚙
        </button>
        <div className={styles.headerTitle}>
          <h1>Web Proxy test</h1>
          <p>currently testin, dont expect much.</p>
        </div>
        <a className={styles.devButton} href="/dev">Developer Panel</a>
      </header>

      {settingsOpen && (
        <div className={styles.settingsOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className={styles.settingsPanel} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className={styles.settingsHeader}>
              <div>
                <p className={styles.settingsEyebrow}>WEB PROXY</p>
                <h2 id="settings-title">Settings</h2>
                <p>Configure the proxy and explore what is hidden.</p>
              </div>
              <button type="button" className={styles.settingsClose} aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            </div>

            <section className={styles.settingsSection} aria-labelledby="general-heading">
              <h3 id="general-heading">General</h3>
              <div className={styles.settingRow}>
                <div><strong>Proxy status</strong><p>The proxy is ready to load a website.</p></div>
                <span className={styles.status}>Online</span>
              </div>
            </section>

            <section className={styles.settingsSection} aria-labelledby="secrets-heading">
              <div className={styles.sectionHeading}>
                <div><h3 id="secrets-heading">Secret codes</h3><p>Found codes can unlock hidden effects.</p></div>
                <span className={styles.counter}>{discoveredEggs.length}/5</span>
              </div>

              <form onSubmit={handleCodeSubmit} className={styles.codeForm}>
                <label htmlFor="secret-code">Enter a code</label>
                <div className={styles.codeRow}>
                  <input id="secret-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter secret code..." autoComplete="off" spellCheck={false} />
                  <button type="submit">Unlock</button>
                </div>
                {settingsMessage && <p className={styles.message} role="status">{settingsMessage}</p>}
              </form>

              <div className={styles.discoveryList}>
                {(Object.keys(EASTER_EGG_CODES) as EasterEgg[]).map((egg) => (
                  <div key={egg} className={styles.discoveryRow}>
                    <span>{discoveredEggs.includes(egg) ? '✓' : '•'}</span>
                    <span>{discoveredEggs.includes(egg) ? EGG_LABELS[egg] : '???'}</span>
                    <span>{discoveredEggs.includes(egg) ? 'Discovered' : 'Undiscovered'}</span>
                  </div>
                ))}
              </div>

              {discoveredEggs.length > 0 && <button type="button" className={styles.clearButton} onClick={clearDiscoveries}>Clear discoveries</button>}
            </section>

            <section className={styles.settingsSection} aria-labelledby="about-heading">
              <h3 id="about-heading">About</h3>
              <p className={styles.aboutText}>Settings is built into the proxy, so it is opened with the button above. The Developer Panel remains separate and untouched.</p>
            </section>
          </section>
        </div>
      )}

      <main className={styles.main} role="main">
        <ProxyForm onRequest={handleProxyRequest} onSpecialInput={handleSpecialInput} />
        {error && <div className={styles.error} role="alert" aria-live="polite" aria-atomic="true"><strong>Error:</strong> {error}</div>}
        {url && <BrowserFrame url={url} onLoad={handleLoad} onError={handleError} />}
      </main>

      <footer className={styles.footer} role="contentinfo"><p>made for apple, may not work elsewhere, idk tbh.</p></footer>
    </div>
  );
}
