import type { Metadata } from 'next';
import { Orbitron, Share_Tech_Mono, Inter } from 'next/font/google';
import './globals.css';

const orbitron = Orbitron({
  subsets  : ['latin'],
  weight   : ['400', '500', '700', '900'],
  variable : '--font-orbitron',
  display  : 'swap',
});

const shareTechMono = Share_Tech_Mono({
  subsets  : ['latin'],
  weight   : ['400'],
  variable : '--font-mono',
  display  : 'swap',
});

const inter = Inter({
  subsets  : ['latin'],
  weight   : ['300', '400', '500', '600'],
  variable : '--font-inter',
  display  : 'swap',
});

export const metadata: Metadata = {
  title       : 'SOC Radar | Security Command Center',
  description : 'Real-time Security Operations Center dashboard. Live SSH attack monitoring, threat geolocation, and Fail2Ban telemetry.',
  keywords    : ['SOC', 'security', 'dashboard', 'SSH', 'Fail2Ban', 'threat intelligence'],
  themeColor  : '#020817',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${shareTechMono.variable} ${inter.variable}`}>
      <body className="bg-cyber-bg antialiased overflow-x-hidden min-h-screen">
        {children}
      </body>
    </html>
  );
}
