'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  EASTER_EGG_CODES,
  discoverEasterEgg,
  findEasterEgg,
  getDiscoveredEasterEggs,
  type EasterEgg,
} from '@/lib/easterEggs';
import styles from './page.module.css';

const EGG_LABELS: Record<EasterEgg, string> = {
  terminal: 'Terminal',
  glitch: 'Glitch',
  retro: 'Retro',
  barrelRoll: 'Barrel Roll',
};

export default function SettingsPage() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [discovered, setDiscovered] = useState<EasterEgg[]>([]);

  useEffect(() => {
    setDiscovered(getDiscoveredEasterEggs());
  }, []);

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const egg = findEasterEgg(code);

    if (!egg) {
      setMessage('That code did not work.');
      return;
    }

    const next = discoverEasterEgg(egg);
    setDiscovered(next);
    setCode('');
    setMessage(`${EGG_LABELS[egg]} effect discovered.`);
  };

  const clearDiscoveries = () => {
    try {
      window.localStorage.removeItem('web-proxy-easter-eggs');
    } catch {
      // Ignore storage failures.
    }
    setDiscovered([]);
    setMessage('Easter egg discoveries cleared.');
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.backLink}>
          ← Back to proxy
        </Link>

        <header className={styles.header}>
          <div className={styles.icon} aria-hidden="true">⚙</div>
          <div>
            <p className={styles.eyebrow}>WEB PROXY</p>
            <h1>Settings</h1>
            <p className={styles.subtitle}>Configure the proxy and explore what is hidden.</p>
          </div>
        </header>

        <section className={styles.section} aria-labelledby="general-heading">
          <h2 id="general-heading">General</h2>
          <div className={styles.settingRow}>
            <div>
              <strong>Proxy status</strong>
              <p>The proxy is ready to load a website.</p>
            </div>
            <span className={styles.status}>Online</span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="secrets-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="secrets-heading">Secret codes</h2>
              <p>Found codes can unlock hidden effects.</p>
            </div>
            <span className={styles.counter}>{discovered.length}/4</span>
          </div>

          <form onSubmit={handleCodeSubmit} className={styles.codeForm}>
            <label htmlFor="secret-code">Enter a code</label>
            <div className={styles.codeRow}>
              <input
                id="secret-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter secret code..."
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit">Unlock</button>
            </div>
            {message && <p className={styles.message} role="status">{message}</p>}
          </form>

          <div className={styles.discoveryList}>
            {(Object.keys(EASTER_EGG_CODES) as EasterEgg[]).map((egg) => (
              <div key={egg} className={styles.discoveryRow}>
                <span>{discovered.includes(egg) ? '✓' : '•'}</span>
                <span>{discovered.includes(egg) ? EGG_LABELS[egg] : '???'}</span>
                <span>{discovered.includes(egg) ? 'Discovered' : 'Undiscovered'}</span>
              </div>
            ))}
          </div>

          {discovered.length > 0 && (
            <button type="button" className={styles.clearButton} onClick={clearDiscoveries}>
              Clear discoveries
            </button>
          )}
        </section>

        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading">About</h2>
          <p className={styles.aboutText}>
            This settings page is intentionally separate from the Developer Panel. The Developer
            Panel button remains reserved for future tools and is not changed here.
          </p>
        </section>
      </div>
    </main>
  );
}
