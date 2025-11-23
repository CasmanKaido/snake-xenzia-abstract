// scripts/withdraw_old_paymaster.ts
// Withdraws all funds from the old GeneralPaymaster contract.
// Run with: npx hardhat run scripts/withdraw_old_paymaster.ts --network abstractTestnet

import { ethers } from "hardhat";

async function main() {
    const OLD_PAYMASTER_ADDRESS = "0xa9E33c595Cb123272F9eCAb9BAb492fe85140f09";

    console.log(`Connecting to old Paymaster at ${OLD_PAYMASTER_ADDRESS}...`);

    // Get the contract instance
    const paymaster = await ethers.getContractAt("GeneralPaymaster", OLD_PAYMASTER_ADDRESS);

    // Check balance
    const provider = ethers.provider;
    const balance = await provider.getBalance(OLD_PAYMASTER_ADDRESS);

    // Handle ethers v5 vs v6
    console.log(`Current Paymaster Balance (Wei): ${balance.toString()}`);

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
    console.log("Withdrawal successful! Funds returned to your wallet.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Withdrawal failed:", error);
        process.exit(1);
    });
