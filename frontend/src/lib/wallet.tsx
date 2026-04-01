"use client";

import { ethers } from "ethers";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WalletContextType {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const TARGET_CHAIN_ID = 11155111; // Ethereum Sepolia
const TARGET_CHAIN_ID_HEX = "0xaa36a7"; // 11155111 in hex

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not installed. Please install MetaMask extension.");
      }

      // First, check and switch to the correct chain
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      
      if (parseInt(currentChainId, 16) !== TARGET_CHAIN_ID) {
        try {
          // Try to switch to Ethereum Sepolia
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }], // 11155111 in hex
          });
        } catch (switchError: unknown) {
          // Chain not added to MetaMask, try adding it
          if ((switchError as { code?: number }).code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: TARGET_CHAIN_ID_HEX,
                  chainName: "Ethereum Sepolia",
                  nativeCurrency: {
                    name: "Sepolia Ether",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://1rpc.io/sepolia", "https://rpc2.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum, {
        chainId: 11155111, // Ethereum Sepolia
        name: "Sepolia",
      });

      // Request account access
      const accounts = await browserProvider.send("eth_requestAccounts", []);

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock MetaMask and try again.");
      }

      const newSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      console.log(`[Wallet] Connected successfully via MetaMask.`);
      console.log(`[Wallet] Selected network chainId=${network.chainId.toString()}`);
      console.log(`[Wallet] Note: Ethers.js forwards ALL transactions to MetaMask. MetaMask then uses its own internal RPC setting for this chain.`);
      console.log(`[Wallet] If transactions fail with "RPC endpoint returned too many errors", you must change the RPC URL directly inside your MetaMask extension network settings.`);
      
      setProvider(browserProvider);
      setSigner(newSigner);
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      setIsConnected(true);
      setIsConnecting(false); // Add this line
      setError(null); // Add this line

      // Store in localStorage for persistence
      localStorage.setItem("walletConnected", "true");
    } catch (err: Error | unknown) {
      console.error("Connection error:", err);
      
      // Filter out expected NETWORK_ERROR during chain switching
      if (err instanceof Error && 
          (err.message.includes("NETWORK_ERROR") || 
           err.message.includes("network changed"))) {
        // This is expected during chain switching, don't show as error
        return;
      }
      
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);
    localStorage.removeItem("walletConnected");
  };

  // Listen for account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnect();
      } else if (accs[0] !== address) {
        setAddress(accs[0]);
        if (provider) {
          provider.getSigner().then(setSigner);
        }
      }
    };

    const handleChainChanged = (newChainId: unknown) => {
      const newChainIdNum = Number(newChainId);
      setChainId(newChainIdNum);
      
      // Only reload if we're not switching to our target chain during connection
      if (isConnecting && newChainIdNum === TARGET_CHAIN_ID) {
        return; // Don't reload during successful chain switch
      }
      
      // For other chain changes, reload as recommended by MetaMask
      window.location.reload();
    };

    const handleDisconnect = () => {
      disconnect();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
      window.ethereum?.removeListener("disconnect", handleDisconnect);
    };
  }, [address, provider]);

  // Removed auto-connect: User explicitly requested to connect freshly on reload/visit
  useEffect(() => {
    console.log("WalletProvider mounted. Wallet will NOT auto-connect. Please click Connect to begin.");
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        provider,
        signer,
        chainId,
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  };
  }
}
