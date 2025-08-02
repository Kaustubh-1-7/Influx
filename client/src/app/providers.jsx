  // src/app/providers.jsx
  'use client';
  import React, { useEffect, useState } from 'react';
  import { RainbowKitProvider, getDefaultWallets, getDefaultConfig, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
  import { WagmiProvider } from 'wagmi';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { useTheme } from 'next-themes';
  import { ThemeProvider } from 'next-themes';
  import { SessionProvider } from 'next-auth/react'; // <-- IMPORT THIS
  import { passetHubTestnet,monadTestnet } from '../../lib/constants';
  import { sepolia } from 'wagmi/chains';
  import { GitHubScoreProvider } from './context/GitHubScoreContext'; // Adjust path if context is elsewhere
  const { wallets } = getDefaultWallets();
  const queryClient = new QueryClient();

  export function Providers({ children }) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [currentWagmiConfig, setCurrentWagmiConfig] = useState(null);

    useEffect(() => {
      setMounted(true);
      const config = getDefaultConfig({
        appName: 'RepuFi on PassetHub',
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        wallets: [ ...wallets ],
        chains: [passetHubTestnet,sepolia,monadTestnet],
        ssr: true,
      });
      setCurrentWagmiConfig(config);
    }, []);

    if (!mounted || !currentWagmiConfig) {
      return null;
    }

    return (
      <WagmiProvider config={currentWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <SessionProvider> {/* <-- WRAP WITH THIS */}
              <GitHubScoreProvider>
              <RainbowKitProvider
                theme={resolvedTheme === 'dark' ? darkTheme() : lightTheme()}
                modalSize="compact"
              >
                {children}
              </RainbowKitProvider>
              </GitHubScoreProvider>
            </SessionProvider> {/* <-- WRAP WITH THIS */}
          </ThemeProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }