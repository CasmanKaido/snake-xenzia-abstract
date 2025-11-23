import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    console.log("Deploying SnakeWager...");

    // Get the contract factory
    const WagerFactory = await ethers.getContractFactory("SnakeWager");

    // Deploy – no constructor arguments
    const wager = await WagerFactory.deploy();
    await wager.waitForDeployment();

    const address = await wager.getAddress();
    console.log("SnakeWager deployed to:", address);

    // Write address to file
    fs.writeFileSync("wager_address.txt", address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
