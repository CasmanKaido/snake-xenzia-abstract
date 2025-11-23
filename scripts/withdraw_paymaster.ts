// scripts/withdraw_paymaster.ts
// Withdraws all funds from the StandardPaymaster
// Run with: npx hardhat run scripts/withdraw_paymaster.ts --network abstractTestnet

import { ethers } from "hardhat";

async function main() {
    const PAYMASTER_ADDRESS = "0xDe2c18B657b3e22f4d014563eB2cF0E37BA84B10";

    console.log(`Withdrawing from Paymaster: ${PAYMASTER_ADDRESS}`);

    // Get the paymaster contract instance
    const paymaster = await ethers.getContractAt("StandardPaymaster", PAYMASTER_ADDRESS);

    // Check balance
    const provider = ethers.provider;
    const balance = await provider.getBalance(PAYMASTER_ADDRESS);
    console.log(`Paymaster Balance (Wei): ${balance.toString()}`);

    if (balance.toString() === "0") {
        console.log("Paymaster is empty. Nothing to withdraw.");
        return;
    }

    // Get the signer (your wallet)
    const [signer] = await ethers.getSigners();
    console.log(`Withdrawing to your wallet: ${signer.address}`);

    // Call withdraw
    const tx = await paymaster.withdraw(signer.address);
    console.log(`Withdrawal transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log("✅ Withdrawal successful! Funds returned to your wallet.");

    // Verify balance
    const newBalance = await provider.getBalance(PAYMASTER_ADDRESS);
    console.log(`New Paymaster Balance (Wei): ${newBalance.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Failed:", error);
        process.exit(1);
    });
