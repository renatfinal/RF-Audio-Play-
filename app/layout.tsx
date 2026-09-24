import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  themeColor: '#0f0b21',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'RF Audio Play',
  description: 'An audio player application migrated from GitHub.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RFAudio',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
