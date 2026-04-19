import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { Address } from '@ton/core';
import type { Sender, SenderArguments } from '@ton/core';
import { useMemo } from 'react';

export function useWallet() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tonWallet = useTonWallet() as any;

  const isConnected = !!address;

  const sender: Sender = useMemo(() => {
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

    return {
      async send() {
        throw new Error('No wallet connected. Please connect a TON wallet.');
      },
    };
  }, [tonConnectUI, tonWallet]);

  return {
    address: address || null,
    isConnected,
    sender,
    walletType: 'tonconnect' as const,
    ready: true,
  };
}
