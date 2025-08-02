// app/layout.jsx
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import AppHeader from './components/AppHeader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* It's cleaner to leave the body tag without layout styles */}
      <body>
        <Providers>
          {/* This new div is our main layout container */}
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <AppHeader />
            
            {/* The 'flex-grow' class makes this main section expand and push the footer down */}
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            
            {/* The footer is a direct child of the flex container, so it gets pushed down */}
            <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
              RepuFi © {new Date().getFullYear()} - Built on PassetHub
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}