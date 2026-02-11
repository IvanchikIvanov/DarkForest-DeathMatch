import type { Metadata } from 'next';
import Providers from './providers';
import '../index.css';

export const metadata: Metadata = {
  title: 'DarkForest Arena',
  description: 'Multiplayer arena battle game on Base',
  other: {
    'base:app_id': '698cdc0bb3590846b383984a',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
