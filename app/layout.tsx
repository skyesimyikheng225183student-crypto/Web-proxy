import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'test web proxy',
  description: 'is cool ig',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Web Proxy',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const buildDate = new Date('2026-08-04T03:29:48Z').toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        <div
          style={{
            position: 'fixed',
            bottom: '8px',
            right: '8px',
            fontSize: '10px',
            opacity: 0.5,
            fontFamily: 'monospace',
            color: 'var(--text-color)',
            backgroundColor: 'var(--bg-color)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            zIndex: 9999,
          }}
          title="Build timestamp - check this to see if app updated"
        >
          v2.1.2 • {buildDate}
        </div>
      </body>
    </html>
  );
}
