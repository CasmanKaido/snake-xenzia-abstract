// scripts/test_paymaster.ts
// Test the paymaster directly
// Run with: npx hardhat run scripts/test_paymaster.ts --network abstractTestnet

import { ethers } from "hardhat";
import { Provider, Wallet, utils } from "zksync-ethers";

async function main() {
    const PAYMASTER_ADDRESS = "0xDe2c18B657b3e22f4d014563eB2cF0E37BA84B10";
    const CONTRACT_ADDRESS = "0xf185fDc10d0d64082A9318c794f172740ddDe18c";

    console.log("Testing Paymaster transaction...");

    // Get provider and wallet
    const provider = new Provider("https://api.testnet.abs.xyz");
    const privateKey = process.env.PRIVATE_KEY || "";
    const wallet = new Wallet(privateKey, provider);

    console.log(`Wallet address: ${wallet.address}`);

    // Get contract
    const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        ["function submitScore(uint256 _score) external"],
        wallet
    );

    // Prepare paymaster params
    const paymasterParams = utils.getPaymasterParams(PAYMASTER_ADDRESS, {
        type: "General",
        innerInput: new Uint8Array(),
    });

    console.log("Paymaster params:", paymasterParams);

    // Send transaction
    try {
        const tx = await contract.submitScore(100, {
            customData: {
                paymasterParams: paymasterParams,
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            },
        });

        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    } catch (error: any) {
        console.error("❌ Transaction failed:", error.message);
        if (error.error) {
            console.error("Error details:", error.error);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
