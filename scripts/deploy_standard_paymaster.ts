// scripts/deploy_standard_paymaster.ts
// Deploy the StandardPaymaster contract to the selected zkSync network.
// Run with: npx hardhat run scripts/deploy_standard_paymaster.ts --network abstractTestnet

import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    console.log("Deploying StandardPaymaster...");

    // Get the contract factory
    const PaymasterFactory = await ethers.getContractFactory("StandardPaymaster");

    // Deploy – no constructor arguments
    const paymaster = await PaymasterFactory.deploy();
    await paymaster.waitForDeployment();

    const address = await paymaster.getAddress();
    console.log("StandardPaymaster deployed to:", address);

    // Write address to file
    fs.writeFileSync("paymaster_address.txt", address);

    console.log("IMPORTANT: You must fund this paymaster address with ETH before using it!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
