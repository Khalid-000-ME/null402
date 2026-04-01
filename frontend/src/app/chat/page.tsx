"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { ethers } from "ethers";
import { encrypt64, decryptHandle } from "@/lib/fhevm";
import { CONTRACT_ADDRESSES, NULL_POOL_ABI } from "@/lib/contracts";
import { PaperAirplaneIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

type Message = {
  role: "user" | "null402" | "system";
  content: string;
  txHash?: string;
  isError?: boolean;
};

export default function ChatPage() {
  const { isConnected, signer, address } = useWallet();
  const [messages, setMessages] = useState<Message[]>([
    { role: "null402", content: "I am null402, your agentic AI for null402. How can I assist you with your encrypted positions today? I can help you fetch balances, deposit, withdraw, borrow, or repay." }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeAction = useCallback(async (action: string, amountStr: string | undefined, target: string = "all") => {
    if (!signer || !address) return;
    try {
      if (action === "balances") {
        setMessages(prev => [...prev, { role: "system", content: "Fetching your encrypted balances from the protocol..." }]);
        
        const response = await fetch(`/api/balances?address=${address}`);
        if (!response.ok) throw new Error("Failed to fetch from /api/balances");
        const data = await response.json();
        
        setMessages(prev => [...prev, { role: "system", content: "Awaiting your wallet signature to explicitly decrypt the requested balance securely natively..." }]);

        let balancesMsg = "";
        try {
          if (target === "collateral" || target === "all") {
            const dec = await decryptHandle(CONTRACT_ADDRESSES.nullPool, address, data.posData.collateral, signer);
            balancesMsg += `**Locked Collateral:** ${ethers.formatEther(dec)} nullETH\n`;
          }
          if (target === "debt" || target === "all") {
             const dec = await decryptHandle(CONTRACT_ADDRESSES.nullPool, address, data.posData.debt, signer);
             balancesMsg += `**Active Debt:** ${ethers.formatEther(dec)} nullUSDC\n`;
          }
           if (target === "neth" || target === "all") {
             const dec = await decryptHandle(CONTRACT_ADDRESSES.collateral, address, data.walletBalances.nEth, signer);
             balancesMsg += `**Wallet nullETH:** ${ethers.formatEther(dec)}\n`;
          }
          if (target === "nusdc" || target === "all") {
            const dec = await decryptHandle(CONTRACT_ADDRESSES.nullToken, address, data.walletBalances.nUsdc, signer);
            balancesMsg += `**Wallet nullUSDC:** ${ethers.formatEther(dec)}\n`;
          }
          
          setMessages(prev => [...prev, { role: "system", content: "Balances successfully decrypted!\n\n" + balancesMsg }]);
        } catch (err: any) {
             setMessages(prev => [...prev, { role: "system", content: "Decryption rejected or failed: " + err.message, isError: true }]);
        }
        return;
      }

      if (!amountStr) throw new Error("Amount is required for this action.");

      const checksummedAddress = ethers.getAddress(address);
      const amountBigInt = ethers.parseEther(amountStr);
      const pool = new ethers.Contract(CONTRACT_ADDRESSES.nullPool, NULL_POOL_ABI, signer);

      setMessages(prev => [...prev, { role: "system", content: `Please confirm the execution of ${action.toUpperCase()} for ${amountStr} tokens in your wallet. Initializing FHE Client-Side SDK...` }]);

      let tx;

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

      if (action === "deposit") {
        const { handle: approveHandle, inputProof: approveProofRaw } = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.collateral, address);
        const token = new ethers.Contract(CONTRACT_ADDRESSES.collateral, ["function approve(address, bytes32, bytes) public returns (bool)"], signer);
        
        setMessages(prev => [...prev, { role: "system", content: "Awaiting token allowance approval signature..." }]);
        const approveTx = await retryWithBackoff(() => token.approve(CONTRACT_ADDRESSES.nullPool, approveHandle, approveProofRaw));
        await approveTx.wait();

        setMessages(prev => [...prev, { role: "system", content: "Approval confirmed. Awaiting deposit transaction signature..." }]);
        const depRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, address);
        tx = await retryWithBackoff(() => pool.deposit(depRes.handle, depRes.inputProof));
      } else if (action === "borrow") {
        const borRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, checksummedAddress);
        const txData = await pool.borrow.populateTransaction(borRes.handle, borRes.inputProof);
        tx = await retryWithBackoff(async () => {
          return await signer.sendTransaction({
            to: CONTRACT_ADDRESSES.nullPool,
            data: txData.data,
            gasLimit: 1000000,
          });
        });
      } else if (action === "repay") {
        const repRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, address);
        tx = await retryWithBackoff(() => pool.repay(repRes.handle, repRes.inputProof));
      } else if (action === "withdraw") {
        const witRes = await encrypt64(amountBigInt, CONTRACT_ADDRESSES.nullPool, checksummedAddress);
        tx = await retryWithBackoff(() => pool.withdraw(witRes.handle, witRes.inputProof));
      }

      if (tx) {
        setMessages(prev => [...prev, { role: "system", content: `${action} transacted successfully!`, txHash: tx.hash }]);
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: "system", content: `Failed to execute ${action}: ${error.message || 'Unknown error'}`, isError: true }]);
    }
  }, [signer, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!res.ok) throw new Error("Agent API failed");

      const data = await res.json();
      const aiResponse = data.result || {};

      setMessages(prev => [...prev, { 
        role: "null402", 
        content: aiResponse.response || "Understood. Executing your intent now." 
      }]);

      if (aiResponse.action && aiResponse.action !== "unknown") {
        await executeAction(aiResponse.action, aiResponse.amount, aiResponse.target);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "system", content: `Error communicating with AI: ${error.message}`, isError: true }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col pt-24 text-foreground">
      <div className="max-w-3xl mx-auto w-full px-4 flex-1 flex flex-col items-center justify-center">
        {!isConnected ? (
          <div className="text-center space-y-4">
            <ShieldCheckIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Please connect your wallet to chat with null402.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col flex-1 pb-24 h-full">
            <div className="mb-8 p-4 shrink-0 text-center">
               <h1 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'var(--font-geist-pixel-line), monospace' }}>null402 Interface</h1>
               <p className="text-sm text-muted-foreground">Your sovereign autonomous web3 agent.</p>
            </div>
            
            <div className="flex-1 w-full flex flex-col justify-end space-y-4 overflow-y-auto min-h-[400px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground ml-8" 
                    : msg.role === "system" ? (msg.isError ? "bg-red-950/50 border border-red-900/50 text-red-200" : "bg-card border border-border/50 text-muted-foreground font-mono text-sm")
                    : "bg-secondary text-secondary-foreground mr-8"
                  }`}>
                    {msg.content}
                    {msg.txHash && (
                      <div className="mt-3 text-xs bg-black/20 p-2 rounded-lg break-all">
                        Tx Hash: <a href={`https://sepolia.etherscan.io/tx/${msg.txHash}`} target="_blank" rel="noreferrer" className="underline hover:text-green-400">{msg.txHash}</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex w-full justify-start">
                  <div className="bg-secondary text-secondary-foreground rounded-2xl px-5 py-3 mr-8 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-background/90 backdrop-blur pb-6 z-50">
          <div className="max-w-3xl mx-auto w-full relative">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask null402 to deposit, withdraw, borrow... Ex: 'Deposit 2 nETH'"
                className="flex-1 bg-secondary/50 border border-border focus:ring-1 focus:ring-primary h-14 rounded-2xl px-6 outline-none transition-all placeholder:text-muted-foreground/60 shadow-lg"
                disabled={isProcessing}
              />
              <button 
                type="submit" 
                disabled={isProcessing || !input.trim()}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-2xl w-14 h-14 flex items-center justify-center transition-all shadow-lg shrink-0"
              >
                <PaperAirplaneIcon className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
