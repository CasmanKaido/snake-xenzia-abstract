// scripts/deploy_paymaster.ts
// Deploy the GeneralPaymaster contract to the selected zkSync network.
// Run with: npx hardhat run scripts/deploy_paymaster.ts --network abstractTestnet

import { ethers } from "hardhat";

async function main() {
    console.log("Deploying GeneralPaymaster...");

    // Get the contract factory (zkSync plugin makes this work the same as EVM)
    const PaymasterFactory = await ethers.getContractFactory("GeneralPaymaster");

    // Deploy – no constructor arguments
    const paymaster = await PaymasterFactory.deploy();
    await paymaster.waitForDeployment();

    const address = await paymaster.getAddress();
    console.log("GeneralPaymaster deployed to:", address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
