"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import EncryptedValue from "@/components/ui/EncryptedValue";
import { useWallet } from "@/lib/wallet";
import { encrypt64, decryptHandle } from "@/lib/fhevm";
import { CONTRACT_ADDRESSES, NULL_POOL_ABI } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

type Tab = "deposit" | "borrow" | "repay" | "withdraw";

export default function BorrowPage() {
  const { isConnected, signer, address } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // [Include exactly the same decryptBalance and handleAction logic as before]
  const decryptBalance = useCallback(async () => {
    if (!isConnected || !signer || !address) {
      setError("Please connect your wallet first");
      return;
    }

    setIsDecrypting(true);
    try {
      const pool = new ethers.Contract(CONTRACT_ADDRESSES.nullPool, NULL_POOL_ABI, signer);
      const position = await pool.getPosition(address);
      
      if (!position.exists) {
        setError("No position found");
        return;
      }

      let collateral = BigInt(0);
      let debt = BigInt(0);
      let debtError = null;
      
      try {
        collateral = await decryptHandle(CONTRACT_ADDRESSES.nullPool, address, position.collateral, signer);
      } catch (err) {
        console.error("Failed to decrypt collateral:", err);
        setError("Failed to decrypt collateral");
        return;
      }
      
      try {
        debt = await decryptHandle(CONTRACT_ADDRESSES.nullPool, address, position.debt, signer);
      } catch (err: any) {
        console.error("Failed to decrypt debt:", err);
        debtError = err.message;
        debt = BigInt(0);
      }

      const balanceText = `Collateral: ${ethers.formatEther(collateral)} ETH${debtError ? `, Debt: Unable to decrypt (likely 0)` : `, Debt: ${ethers.formatEther(debt)} ETH`}`;
      setDecryptedBalance(balanceText);
    } catch (err: Error | unknown) {
      console.error("Decryption failed:", err);
      setError(err instanceof Error ? err.message : "Failed to decrypt balance");
    } finally {
      setIsDecrypting(false);
    }
  }, [isConnected, signer, address]);

  const handleAction = useCallback(async (action: Tab) => {
    if (!isConnected || !signer || !address || !amount) {
      setError("Please connect your wallet and enter an amount");
      return;
    }

    const signerAddress = await signer.getAddress();
    const checksummedAddress = ethers.getAddress(address);

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try { return await fn(); } catch (err: any) {
          if (err.message?.includes("RPC endpoint returned too many errors") && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 30000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }
    };

    try {
      const amountBigInt = ethers.parseEther(amount);
      const pool = new ethers.Contract(CONTRACT_ADDRESSES.nullPool, NULL_POOL_ABI, signer);
      
      let tx;
      switch (action) {
        case "deposit":
          const { handle: approveHandle, inputProof: approveProofRaw } = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.collateral, address);
          const approveProof = approveProofRaw;
          let approveTx;
          try {
            const token = new ethers.Contract(CONTRACT_ADDRESSES.collateral, ["function approve(address, bytes32, bytes) public returns (bool)"], signer);
            approveTx = await retryWithBackoff(() => token.approve(CONTRACT_ADDRESSES.nullPool, approveHandle, approveProof));
          } catch (err) { throw err; }

          setTxHash(approveTx.hash);
          await approveTx.wait();
          
          const depRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, address);
          tx = await retryWithBackoff(() => pool.deposit(depRes.handle, depRes.inputProof));
          break;

        case "borrow":
          const borRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, checksummedAddress);
          const txData = await pool.borrow.populateTransaction(borRes.handle, borRes.inputProof);
          tx = await retryWithBackoff(async () => {
            return await signer.sendTransaction({
              to: CONTRACT_ADDRESSES.nullPool,
              data: txData.data,
              gasLimit: 1000000,
            });
          });
          break;

        case "repay":
          const repRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, address);
          tx = await retryWithBackoff(() => pool.repay(repRes.handle, repRes.inputProof));
          break;

        case "withdraw":
          const witRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, checksummedAddress);
          tx = await retryWithBackoff(() => pool.withdraw(witRes.handle, witRes.inputProof));
          break;
      }

      if (tx) {
        setTxHash(tx.hash);
        await tx.wait();
        alert(`${action} successful!`);
        setAmount("");
      }
    } catch (err: Error | unknown) {
      console.error(`${action} failed:`, err);
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, signer, address, amount]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden text-foreground">
      
      {/* Background gradients */}
      <main className="max-w-4xl mx-auto px-6 py-32">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ fontFamily: 'var(--font-geist-pixel-line), monospace' }}>
            Borrow
          </h1>
          <p className="text-muted-foreground text-lg">
            Deposit encrypted collateral, borrow against it, repay or withdraw — all amounts stay encrypted on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Action Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex p-1 bg-secondary/50 rounded-xl backdrop-blur-sm border border-border">
              {(["deposit", "borrow", "repay", "withdraw"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg capitalize transition-all duration-200 ${
                    activeTab === tab 
                      ? "bg-background text-foreground shadow-sm card-shadow" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Action Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 card-shadow noise-bg relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    {activeTab === "deposit" || activeTab === "withdraw" ? "Asset" : activeTab === "borrow" ? "Borrow Asset" : "Repay Asset"}
                  </label>
                  <div className="w-full bg-secondary/50 border border-border rounded-xl p-4 flex items-center justify-between pointer-events-none">
                    <span className="font-mono text-foreground font-medium">
                      {activeTab === "deposit" || activeTab === "withdraw" ? "nullETH" : "nullUSDC"}
                    </span>
                    <span className="text-muted-foreground text-xs">FHE ENABLED</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-2xl p-4 rounded-xl outline-none font-mono transition-all duration-200"
                      min="0"
                      step="any"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10">MAX</Button>
                    </div>
                  </div>
                  
                  {activeTab === "deposit" && (
                    <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground font-mono">
                      <span>Current LTV: 75%</span>
                      <span>Liquidation: 80%</span>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground group"
                    disabled={!amount || isLoading || !isConnected}
                    onClick={() => handleAction(activeTab)}
                  >
                    {isLoading ? (
                      <><ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Encrypting & Processing...</>
                    ) : (
                      <span className="capitalize">{activeTab} {activeTab === "deposit" || activeTab === "withdraw" ? "Collateral" : ""} </span>
                    )}
                    {!isLoading && <ArrowRightIcon className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />}
                  </Button>
                </div>

                {error && <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 text-sm font-mono text-center">{error}</div>}
                {txHash && (
                  <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/50 text-green-400 text-sm font-mono text-center">
                    Tx Submitted:{" "}
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-green-300 transition-colors"
                    >
                      {txHash.slice(0, 14)}...
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-6 card-shadow relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h3 className="text-lg font-medium mb-4 flex items-center justify-between">
                  Your Balance
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                </h3>
                
                {decryptedBalance ? (
                  <div className="bg-secondary/50 rounded-xl p-4 border border-border/50 font-mono text-sm text-primary break-all">
                    {decryptedBalance.split(", ").map((line, i) => (
                      <div key={i} className="mb-1 last:mb-0">{line}</div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/30 font-mono text-sm text-muted-foreground flex items-center justify-center min-h-[80px]">
                    <div className="flex items-center gap-2">
                      <span className="opacity-50">#*^~10</span> 
                      <span className="opacity-50">ENCRYPTED</span>
                      <span className="opacity-50">_[</span> 
                    </div>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full mt-4 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors duration-300"
                  onClick={decryptBalance}
                  disabled={isDecrypting || !isConnected}
                >
                  {isDecrypting ? <><ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Decrypting Auth...</> : "Decrypt Balance"}
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-secondary/30 rounded-2xl border border-primary/20 p-6">
              <div className="flex gap-3">
                <InformationCircleIcon className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your borrow position is fully encrypted on-chain using Zama fhEVM. Liquidation bots receive non-compute ciphertexts. They can mathematically execute liquidations if rules flag invalidity, but cannot target or front-run your exact position. Overcollateralization with zero MEV exposure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
