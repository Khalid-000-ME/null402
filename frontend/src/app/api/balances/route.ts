import { NextResponse } from "next/server";
import { ethers } from "ethers";

const NEXT_PUBLIC_NULL_POOL_ADDRESS = "0x1b832D5395A41446b508632466cf32c6C07D63c7";
const NEXT_PUBLIC_NULL_TOKEN_ADDRESS = "0xd183f760E74Ebc5D84dc9A09e2e79C378Aab3BDC";
const NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS = "0x6945a84E678451a289cAdBEb998FDb0c4c2d23C3";

const POOL_ABI = [
  "function getPosition(address borrower) external view returns (uint256 collateral, uint256 debt, uint256 lastUpdateBlock, bool exists)"
];
const MOCK_ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    
    // Load position
    const pool = new ethers.Contract(NEXT_PUBLIC_NULL_POOL_ADDRESS, POOL_ABI, provider);
    const result = await pool.getPosition(address);
    const posData = {
      collateral: result[0].toString(),
      debt: result[1].toString(),
      lastUpdateBlock: result[2].toString(),
      exists: result[3]
    };

    // Load wallet balances (encrypted handles)
    const nEthToken = new ethers.Contract(NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS, MOCK_ERC20_ABI, provider);
    const nEthHandle = await nEthToken.balanceOf(address);

    const nUsdcToken = new ethers.Contract(NEXT_PUBLIC_NULL_TOKEN_ADDRESS, MOCK_ERC20_ABI, provider);
    const nUsdcHandle = await nUsdcToken.balanceOf(address);

    return NextResponse.json({
      posData,
      walletBalances: {
        nEth: nEthHandle.toString(),
        nUsdc: nUsdcHandle.toString()
      }
    });
  } catch (error: any) {
    console.error("Balances API error:", error);
    return NextResponse.json({ error: "Failed to fetch balances", details: error.message }, { status: 500 });
  }
}
