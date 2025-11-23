// scripts/withdraw_and_fund.ts
// Withdraws from old paymaster and funds the new one
// Run with: npx hardhat run scripts/withdraw_and_fund.ts --network abstractTestnet

import { ethers } from "hardhat";

async function main() {
    const OLD_PAYMASTER_ADDRESS = "0xdfc9ffc925349e5Af1534d260bb0Bb324472E506";
    const NEW_PAYMASTER_ADDRESS = "0xDe2c18B657b3e22f4d014563eB2cF0E37BA84B10";

    console.log(`Withdrawing from old Paymaster: ${OLD_PAYMASTER_ADDRESS}`);

    // Get the old paymaster contract instance
    const oldPaymaster = await ethers.getContractAt("StandardPaymaster", OLD_PAYMASTER_ADDRESS);

    // Check balance
    const provider = ethers.provider;
    const balance = await provider.getBalance(OLD_PAYMASTER_ADDRESS);
    console.log(`Old Paymaster Balance (Wei): ${balance.toString()}`);

    if (balance.toString() === "0") {
        console.log("Old Paymaster is empty. Nothing to withdraw.");
        return;
    }

    // Get the signer (your wallet)
    const [signer] = await ethers.getSigners();
    console.log(`Withdrawing to your wallet: ${signer.address}`);

    // Call withdraw
    const tx = await oldPaymaster.withdraw(signer.address);
    console.log(`Withdrawal transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log("✅ Withdrawal successful!");

    // Now send to new paymaster
    console.log(`\nFunding new Paymaster: ${NEW_PAYMASTER_ADDRESS}`);

    const fundTx = await signer.sendTransaction({
        to: NEW_PAYMASTER_ADDRESS,
        value: balance // Send the same amount we withdrew
    });

    console.log(`Funding transaction sent: ${fundTx.hash}`);
    await fundTx.wait();

    console.log("✅ New Paymaster funded successfully!");

    // Verify new balance
    const newBalance = await provider.getBalance(NEW_PAYMASTER_ADDRESS);
    console.log(`New Paymaster Balance (Wei): ${newBalance.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Failed:", error);
        process.exit(1);
    });
