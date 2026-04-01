import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

/**
 * Wagmi v2 config for null402.
 * Targets Ethereum Sepolia with Zama fhEVM executor.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    // Add walletConnect if PROJECT_ID provided
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
          }),
        ]
      : []),
  ],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org"
    ),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
