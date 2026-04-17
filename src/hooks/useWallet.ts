import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Address, Sender, SenderArguments } from '@ton/core';
import { useMemo } from 'react';

export function useWallet() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();  // from TonConnect

  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();

  // Determine wallet type and address
  const walletType = useMemo(() => {
    if (tonAddress) return 'tonconnect' as const;
    if (authenticated && ready) return 'privy' as const;
    return 'none' as const;
  }, [tonAddress, authenticated, ready]);

  // For Privy: use the linked wallet address (EVM-based embedded wallet address as identifier)
  // The user object's wallet field is the embedded wallet Privy creates
  const privyAddress = useMemo(() => {
    if (!authenticated || !ready) return null;
    // Check wallets array first (most up to date)
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    if (embeddedWallet?.address) return embeddedWallet.address;
    // Fall back to user.wallet
    if (user?.wallet?.address) return user.wallet.address;
    return null;
  }, [authenticated, ready, wallets, user]);

  const address = useMemo(() => {
    if (tonAddress) return tonAddress;
    if (privyAddress) return privyAddress;
    return null;
  }, [tonAddress, privyAddress]);

  const isConnected = !!address;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tonWallet = useTonWallet() as any;

  const sender: Sender = useMemo(() => {
    // 1. Priority: TonConnect hardware/software wallet
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

    // 2. Privy embedded wallet
    if (authenticated && wallets.length > 0) {
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
      if (embeddedWallet) {
        return {
          address: undefined, // Privy embedded wallets are EVM-based, TON signing not yet natively supported
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          async send(_args: SenderArguments) {
            throw new Error(
              'Privy embedded wallets do not yet support direct TON transaction signing. Please connect a TON wallet (Tonkeeper) to sign transactions.'
            );
          },
        };
      }
    }

    // 3. No wallet connected
    return {
      async send() {
        throw new Error('No wallet connected. Please connect a TON wallet.');
      },
    };
  }, [tonConnectUI, tonWallet, authenticated, wallets]);

  return {
    address,
    isConnected,
    sender,
    walletType,
    ready,
  };
}
