"use client";

import { useState, useEffect } from "react";
import EncryptedValue from "@/components/ui/EncryptedValue";
import { useWallet } from "@/lib/wallet";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, MOCK_ERC20_ABI } from "@/lib/contracts";
import { BoltIcon, WalletIcon } from "@heroicons/react/24/outline";

const POOL_ABI = [
  "function getPosition(address borrower) external view returns (uint256 collateral, uint256 debt, uint256 lastUpdateBlock, bool exists)"
];

export default function DashboardPage() {
  const { isConnected, signer, address } = useWallet();
  const [posData, setPosData] = useState<{ collateral?: bigint; debt?: bigint; exists?: boolean; lastUpdateBlock?: bigint } | null>(null);
  const [walletBalances, setWalletBalances] = useState<{ nEth?: bigint; nUsdc?: bigint } | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!signer || !address) return;
      try {
        // Fetch from new native API route
        const response = await fetch(`/api/balances?address=${address}`);
        if (!response.ok) throw new Error("Failed to fetch from /api/balances");
        const data = await response.json();

        setPosData({
          collateral: BigInt(data.posData.collateral),
          debt: BigInt(data.posData.debt),
          lastUpdateBlock: BigInt(data.posData.lastUpdateBlock),
          exists: data.posData.exists
        });

        setWalletBalances({
          nEth: BigInt(data.walletBalances.nEth),
          nUsdc: BigInt(data.walletBalances.nUsdc)
        });
        
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }
    loadData();
  }, [signer, address]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <BoltIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Please connect your wallet to view your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -mr-80 -mt-80 pointer-events-none" />
      
      <main className="max-w-5xl mx-auto px-6 py-32 space-y-8 relative z-10">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ fontFamily: 'var(--font-geist-pixel-line), monospace' }}>
            Dashboard
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Your comprehensive encrypted state. All values remain strictly secure and encrypted on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box 1: Collateral Locked */}
          <div className="bg-card rounded-3xl border border-border/50 p-8 card-shadow noise-bg relative overflow-hidden flex flex-col justify-center min-h-[200px] transition-transform hover:-translate-y-1 duration-300">
            <div className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
              <BoltIcon className="w-5 h-5 text-primary" /> Locked Collateral
            </div>
            {posData && posData.exists ? (
               <EncryptedValue
                  handle={posData.collateral}
                  contractAddress={CONTRACT_ADDRESSES.nullPool}
                  userAddress={address!}
                  signer={signer!}
                  formatDecrypted={(val) => parseFloat(ethers.formatEther(val)).toFixed(3) + " nullETH"}
                  className="text-3xl font-mono text-foreground font-semibold"
               />
            ) : (
               <span className="text-muted-foreground/40 font-mono text-2xl">No Active Position</span>
            )}
          </div>

          {/* Box 2: Debt Drawn */}
          <div className="bg-card rounded-3xl border border-border/50 p-8 card-shadow noise-bg relative overflow-hidden flex flex-col justify-center min-h-[200px] transition-transform hover:-translate-y-1 duration-300">
            <div className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
              <BoltIcon className="w-5 h-5 text-red-400" /> Active Debt
            </div>
            {posData && posData.exists ? (
               <EncryptedValue
                  handle={posData.debt}
                  contractAddress={CONTRACT_ADDRESSES.nullPool}
                  userAddress={address!}
                  signer={signer!}
                  formatDecrypted={(val) => parseFloat(ethers.formatEther(val)).toFixed(3) + " nullUSDC"}
                  className="text-3xl font-mono text-foreground font-semibold"
               />
            ) : (
               <span className="text-muted-foreground/40 font-mono text-2xl">No Active Position</span>
            )}
          </div>

          {/* Box 3: Wallet nETH */}
          <div className="bg-card/40 backdrop-blur-xl rounded-3xl border border-border/50 p-8 relative overflow-hidden flex flex-col justify-center min-h-[200px] transition-transform hover:-translate-y-1 duration-300">
            <div className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
              <WalletIcon className="w-5 h-5 text-blue-400" /> nullETH Balance
            </div>
            {walletBalances?.nEth !== undefined ? (
              <EncryptedValue
                 handle={walletBalances.nEth}
                 contractAddress={CONTRACT_ADDRESSES.collateral}
                 userAddress={address!}
                 signer={signer!}
                 formatDecrypted={(val) => parseFloat(ethers.formatEther(val)).toFixed(3) + " nullETH"}
                 className="text-3xl font-mono text-foreground font-semibold"
              />
            ) : (
              <span className="text-muted-foreground/40 font-mono text-2xl animate-pulse">Scanning wallet...</span>
            )}
          </div>

          {/* Box 4: Wallet nUSDC */}
          <div className="bg-card/40 backdrop-blur-xl rounded-3xl border border-border/50 p-8 relative overflow-hidden flex flex-col justify-center min-h-[200px] transition-transform hover:-translate-y-1 duration-300">
             <div className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
              <WalletIcon className="w-5 h-5 text-green-400" /> nullUSDC Balance
            </div>
            {walletBalances?.nUsdc !== undefined ? (
              <EncryptedValue
                 handle={walletBalances.nUsdc}
                 contractAddress={CONTRACT_ADDRESSES.nullToken}
                 userAddress={address!}
                 signer={signer!}
                 formatDecrypted={(val) => parseFloat(ethers.formatEther(val)).toFixed(3) + " nullUSDC"}
                 className="text-3xl font-mono text-foreground font-semibold"
              />
            ) : (
              <span className="text-muted-foreground/40 font-mono text-2xl animate-pulse">Scanning wallet...</span>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
