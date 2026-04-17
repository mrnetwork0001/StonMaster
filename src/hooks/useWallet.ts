import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Address, Sender, SenderArguments } from '@ton/core';
import { useMemo } from 'react';

export function useWallet() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();  // from TonConnect

  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();

  // Determine wallet type
  const walletType = useMemo(() => {
    if (tonAddress) return 'tonconnect' as const;
    if (authenticated) return 'privy' as const;
    return 'none' as const;
  }, [tonAddress, authenticated]);

  // Display address: use TonConnect address, or fall back to the user's identifier from Privy
  const address = useMemo(() => {
    if (tonAddress) return tonAddress;

    if (authenticated && user) {
      // Try all possible embedded wallet addresses first
      if (wallets.length > 0) {
        const embeddedWallet = wallets.find(w =>
          w.walletClientType === 'privy' ||
          w.connectorType === 'embedded'
        );
        if (embeddedWallet?.address) return embeddedWallet.address;
        // Any wallet address from Privy
        if (wallets[0]?.address) return wallets[0].address;
      }
      // Fall back to email as a display identifier (truncated)
      if (user.email?.address) return user.email.address;
      if (user.google?.email) return user.google.email;
      // Last resort: use the Privy user ID
      if (user.id) return `privy:${user.id.slice(-8)}`;
    }

    return null;
  }, [tonAddress, authenticated, user, wallets]);

  const isConnected = !!address;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tonWallet = useTonWallet() as any;

  const sender: Sender = useMemo(() => {
    // 1. Priority: TonConnect (can actually sign TON transactions)
    if (tonWallet?.account) {
      return {
        address: Address.parse(tonWallet.account.address),
        async send(args: SenderArguments) {
          await tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 120,
            messages: [
              {
                address: args.to.toString(),
                amount: args.value.toString(),
                payload: args.body?.toBoc().toString('base64'),
              },
            ],
          });
        },
      };
    }

    // 2. Privy user authenticated — cannot sign TON txns natively
    if (authenticated) {
      return {
        address: undefined,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async send(_args: SenderArguments) {
          throw new Error(
            'Social login does not support TON transaction signing. Please also connect a TON wallet (Tonkeeper) to execute swaps.'
          );
        },
      };
    }

    // 3. No wallet
    return {
      async send() {
        throw new Error('No wallet connected. Please connect a TON wallet.');
      },
    };
  }, [tonConnectUI, tonWallet, authenticated]);

  return {
    address,
    isConnected,
    sender,
    walletType,
    ready,
  };
}
