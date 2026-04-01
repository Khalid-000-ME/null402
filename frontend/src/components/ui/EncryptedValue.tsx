"use client";

import { useState } from "react";
import { decryptHandle } from "@/lib/fhevm";
import { ethers } from "ethers";
import { ArrowPathIcon, LockOpenIcon } from "@heroicons/react/24/outline";

interface EncryptedValueProps {
  /** The cipher handle (from the contract) */
  handle?: bigint | string;
  /** Contract address where the variable is stored */
  contractAddress?: string;
  /** Address of the user triggering the popup */
  userAddress?: string;
  /** Ethers.js JSON RPC signer */
  signer?: ethers.JsonRpcSigner | null;
  /** Fallback string if true decryption is missing */
  revealedValueFallback?: string;
  /** Label for the decrypt button (default: [Decrypt →]) */
  decryptLabel?: string;
  /** Hide the decrypt button */
  noDecryptButton?: boolean;
  /** Additional class on the wrapper */
  className?: string;
  /** Format function for displaying decrypted value */
  formatDecrypted?: (val: string) => string;
}

export default function EncryptedValue({
  handle,
  contractAddress,
  userAddress,
  signer,
  revealedValueFallback,
  decryptLabel = "[Decrypt →]",
  noDecryptButton = false,
  className = "",
  formatDecrypted = (val) => val,
}: EncryptedValueProps) {
  const [revealed, setRevealed] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [val, setVal] = useState<string | null>(null);

  const handleDecrypt = async () => {
    setDecrypting(true);
    try {
      if (handle && contractAddress && userAddress && signer) {
        let hexHandle = handle.toString(16);
        if (!hexHandle.startsWith("0x")) {
          hexHandle = "0x" + hexHandle.padStart(64, "0");
        }
        const plain = await decryptHandle(
          contractAddress,
          userAddress,
          hexHandle,
          signer as any
        );
        setVal(formatDecrypted(plain.toString()));
        setRevealed(true);
      } else if (revealedValueFallback) {
        await new Promise((r) => setTimeout(r, 1200));
        setVal(revealedValueFallback);
        setRevealed(true);
      } else {
        console.warn("No handle or fallback provided for decryption.");
      }
    } catch (err: any) {
      console.error("Decryption failed:", err);
      alert("Decryption failed: " + err.message);
    } finally {
      setDecrypting(false);
    }
  };

  if (revealed && val) {
    return (
      <span
        className={`${className}`}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          color: "var(--white)",
        }}
      >
        {val}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span className="px-2 py-0.5 rounded border border-border bg-secondary/50 text-muted-foreground text-xs font-mono select-none">
        {decrypting ? "Decrypting..." : "Encrypted"}
      </span>
      {!noDecryptButton && (handle !== undefined || revealedValueFallback) && (
        <button
          className="px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium font-sans border border-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
          onClick={handleDecrypt}
          disabled={decrypting}
        >
          {decrypting ? (
            <><ArrowPathIcon className="w-3 h-3 animate-spin" /> ...</>
          ) : (
            <><LockOpenIcon className="w-3 h-3" /> {decryptLabel === "[Decrypt →]" ? "Decrypt" : decryptLabel}</>
          )}
        </button>
      )}
    </span>
  );
}
