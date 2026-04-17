import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Address, Sender, SenderArguments } from '@ton/core';
import { useMemo } from 'react';

export function useWallet() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  // Find the TON wallet if it exists in Privy
  const privyTonWallet = useMemo(() => {
    return wallets.find((w) => w.connectorType === 'embedded' && w.chainId.includes('ton'));
  }, [wallets]);

  const address = useMemo(() => {
    if (tonAddress) return tonAddress;
    if (authenticated && user?.wallet?.address) return user.wallet.address;
    return null;
  }, [tonAddress, authenticated, user]);

  const isConnected = !!address;

  const tonWallet = useTonWallet() as any;
  const sender: Sender = useMemo(() => {
    // 1. Priority: TonConnect
    if (tonWallet?.account) {
      return {
        address: Address.parse(tonWallet.account.address),
        async send(args: SenderArguments) {
          await tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 120, // 2 mins
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

    // 2. Fallback: Privy
    if (authenticated && privyTonWallet) {
      return {
        address: address ? Address.parse(address) : undefined,
        async send(args: SenderArguments) {
          // Privy Tier 2 TON sending logic
          // Note: This requires the wallet to be 'embedded' and specifically for TON
          // @ts-ignore - Tier 2 provider might have specific methods
          const provider = await privyTonWallet.getProvider();
          
          await provider.request({
            method: 'ton_sendTransaction',
            params: [{
              address: args.to.toString(),
              amount: args.value.toString(),
              payload: args.body?.toBoc().toString('base64'),
            }]
          });
        },
      };
    }

    // 3. Mock/Null sender
    return {
      async send() {
        throw new Error('No wallet connected or provider not available');
      },
    };
  }, [tonConnectUI, tonWallet, authenticated, privyTonWallet, address]);

  return {
    address,
    isConnected,
    sender,
    walletType: tonConnectUI.account ? 'tonconnect' : (authenticated ? 'privy' : 'none'),
  };
}
