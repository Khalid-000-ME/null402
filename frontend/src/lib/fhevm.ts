import { ethers } from "ethers";

// Persist across Next.js Fast Refresh module reloads using globalThis
const g = globalThis as typeof globalThis & {
  _fhevmSdk?: unknown;
  _fhevmInstance?: unknown;
  _fhevmInitPromise?: Promise<unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sdkModule: any = null;

async function getSdk() {
  if (typeof window === "undefined") {
    throw new Error("fhEVM SDK only available in browser");
  }
  
  // Use cached module from globalThis to survive Fast Refresh
  if (g._fhevmSdk) return g._fhevmSdk as any;
  
  // Add global polyfill for SDK compatibility
  if (typeof window.global === "undefined") {
    (window as any).global = window;
  }
  
  // Import and cache the module
  const module = await import("@zama-fhe/relayer-sdk/web");
  
  // Initialize SDK WASM before using
  if (module.initSDK) {
    await module.initSDK();
  }
  
  g._fhevmSdk = module;
  return module as any;
}

export interface EncryptResult {
  handle: `0x${string}`;
  inputProof: `0x${string}`;
}

/**
 * Initialize the fhEVM Relayer instance — only ONCE per browser session.
 * Uses globalThis to survive Next.js Fast Refresh.
 * Uses a pending promise to prevent parallel inits on double-click.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initFhevm(): Promise<any> {
  // Already initialized
  if (g._fhevmInstance) return g._fhevmInstance;

  // Initialization already in progress — wait for it instead of starting another
  if (g._fhevmInitPromise) return g._fhevmInitPromise;

  // Start initialization and cache the promise
  const init = async () => {
    const { createInstance, SepoliaConfig } = await getSdk();
    
    // Use default SepoliaConfig for Ethereum Sepolia
    const instance = await createInstance(SepoliaConfig);
    
    g._fhevmInstance = instance;
    g._fhevmInitPromise = undefined; // Clear the promise
    return instance;
  };
  
  g._fhevmInitPromise = init();
  return g._fhevmInitPromise;
}

/**
 * Encrypt a 128-bit value using the Relayer SDK.
 */
export async function encrypt128(
  amount: bigint,
  contractAddress: string,
  userAddress: string
): Promise<EncryptResult> {
  const checksummedContractAddress = ethers.getAddress(contractAddress);
  const checksummedUserAddress = ethers.getAddress(userAddress);

  console.log("[encrypt128] Starting encryption...");
  console.log("[encrypt128] Contract address:", checksummedContractAddress);
  console.log("[encrypt128] User address:", checksummedUserAddress);
  console.log("[encrypt128] Amount:", amount.toString());

  const fhevm = await initFhevm();
  console.log("[encrypt128] fhEVM initialized successfully");

  console.log("[encrypt128] Calling createEncryptedInput...");
  let buffer;
  try {
    buffer = fhevm.createEncryptedInput(checksummedContractAddress, checksummedUserAddress);
    console.log("[encrypt128] Buffer created returned successfully:", !!buffer);
  } catch (err) {
    console.error("[encrypt128] Failed at createEncryptedInput:", err);
    throw err;
  }

  console.log("[encrypt128] Adding 128-bit value...");
  try {
    buffer.add128(amount);
    console.log("[encrypt128] add128 returned successfully");
  } catch (err) {
    console.error("[encrypt128] Failed at add128:", err);
    throw err;
  }

  console.log("[encrypt128] Calling buffer.encrypt()...");
  let handles, inputProof;
  try {
    const result = await buffer.encrypt();
    handles = result.handles;
    inputProof = result.inputProof;
    console.log("[encrypt128] buffer.encrypt() resolved successfully");
  } catch (err) {
    console.error("[encrypt128] Failed at buffer.encrypt():", err);
    throw err;
  }

  const toHex = (arr: Uint8Array) =>
    "0x" + Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return {
    handle: toHex(handles[0]) as `0x${string}`,
    inputProof: toHex(inputProof) as `0x${string}`,
  };
}

export async function encrypt64(
  amount: bigint,
  contractAddress: string,
  userAddress: string
): Promise<EncryptResult> {
  const checksummedContractAddress = ethers.getAddress(contractAddress);
  const checksummedUserAddress = ethers.getAddress(userAddress);

  const fhevm = await initFhevm();

  let buffer;
  try {
    buffer = fhevm.createEncryptedInput(checksummedContractAddress, checksummedUserAddress);
  } catch (err) {
    throw err;
  }

  try {
    buffer.add64(amount);
  } catch (err) {
    throw err;
  }

  let handles, inputProof;
  try {
    const result = await buffer.encrypt();
    handles = result.handles;
    inputProof = result.inputProof;
  } catch (err) {
    throw err;
  }

  const toHex = (arr: Uint8Array) =>
    "0x" + Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return {
    handle: toHex(handles[0]) as `0x${string}`,
    inputProof: toHex(inputProof) as `0x${string}`,
  };
}

/**
 * Decrypt (unseal) an encrypted handle using the Relayer SDK's userDecrypt.
 */
export async function decryptHandle(
  contractAddress: string,
  userAddress: string,
  handle: string,
  signer: ethers.JsonRpcSigner
): Promise<bigint> {
  const checksummedContractAddress = ethers.getAddress(contractAddress);
  const checksummedUserAddress = ethers.getAddress(userAddress);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fhevm = await initFhevm() as any;

  const keypair = fhevm.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;

  console.log('[decryptHandle] Decrypting handle:', handle, '| contractAddress:', contractAddress, '| userAddress:', userAddress);

  const eip712 = fhevm.createEIP712(
    keypair.publicKey,
    [checksummedContractAddress],
    startTimestamp,
    durationDays
  );

  const signature = await signer.signTypedData(
    eip712.domain,
    {
      UserDecryptRequestVerification: [...eip712.types.UserDecryptRequestVerification],
    },
    eip712.message
  );

  const result = await fhevm.userDecrypt(
    [{ handle: BigInt(handle).toString(16).padStart(64, '0') as `0x${string}`, contractAddress: checksummedContractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    [checksummedContractAddress],
    checksummedUserAddress,
    startTimestamp,
    durationDays
  );

  console.log('[decryptHandle] userDecrypt result:', JSON.stringify(result, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
  return BigInt(Object.values(result)[0] as string);
}

export function getFhevmInstance() {
  return g._fhevmInstance;
}
