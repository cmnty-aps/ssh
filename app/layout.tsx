import type {Metadata, Viewport} from 'next';
import {Plus_Jakarta_Sans, JetBrains_Mono} from 'next/font/google';
import './globals.css';
import 'highlight.js/styles/github-dark.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Remix SSH Flow',
  description:
    'A seamless, secure web-based SSH client for managing your servers directly from your browser.',
  openGraph: {
    title: 'Remix SSH Flow',
    description:
      'A seamless, secure web-based SSH client for managing your servers directly from your browser.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remix SSH Flow',
    description:
      'A seamless, secure web-based SSH client for managing your servers directly from your browser.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body
        suppressHydrationWarning
        className="font-sans antialiased bg-zinc-950 text-zinc-100 selection:bg-zinc-100 selection:text-zinc-950"
      >
        {children}
      </body>
    </html>
  );
}
