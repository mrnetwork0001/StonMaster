import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Omniston, OmnistonProvider } from '@ston-fi/omniston-sdk-react';
import { LandingPage } from './pages/LandingPage';
import { AppLayout } from './components/Layout/AppLayout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { SweepPage } from './modules/Sweep/SweepPage';
import { EarnPage } from './modules/Earn/EarnPage';
import { SharePage } from './modules/Share/SharePage';
import { AdvancedSwapPage } from './modules/AdvancedSwap/AdvancedSwapPage';
import { PrivyProvider } from '@privy-io/react-auth';
import { MANIFEST_URL } from './utils/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const App: React.FC = () => {
  // Initialize Omniston for Mainnet
  const omniston = useMemo(() => new Omniston({ apiUrl: "wss://omni-ws.ston.fi" }), []);

  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || 'insert_your_privy_app_id'}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#6C63FF',
          logo: '/logo.png',
          showWalletLoginFirst: false,
          loginMethods: ['email', 'google', 'twitter', 'github'],
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
          showWalletUIs: true,
        },
      }}
    >
      <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
        <QueryClientProvider client={queryClient}>
          <OmnistonProvider omniston={omniston}>
            <BrowserRouter>
              <Routes>
                {/* Landing page — no sidebar/header */}
                <Route path="/" element={<LandingPage />} />

                {/* Main app with sidebar layout */}
                <Route element={<AppLayout />}>
                  <Route path="/app" element={<Dashboard />} />
                  <Route path="/sweep" element={<SweepPage />} />
                  <Route path="/earn" element={<EarnPage />} />
                  <Route path="/share" element={<SharePage />} />
                  <Route path="/swap" element={<AdvancedSwapPage />} />
                  {/* Short link handler */}
                  <Route path="/s/:id" element={<SharePage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </OmnistonProvider>
        </QueryClientProvider>
      </TonConnectUIProvider>
    </PrivyProvider>
  );
};

export default App;
