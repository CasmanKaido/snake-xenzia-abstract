import { Wallet, Provider, utils } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { vars } from "hardhat/config";
import * as ethers from "ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
    console.log(`Running deploy script for GeneralPaymaster`);

    // Initialize the wallet.
    const wallet = new Wallet(vars.get("DEPLOYER_PRIVATE_KEY"));

    // Create deployer object and load the artifact of the contract we want to deploy.
    const deployer = new Deployer(hre, wallet);

    // Load contract
    const artifact = await deployer.loadArtifact("GeneralPaymaster");

    // Deploy this contract.
    const paymaster = await deployer.deploy(artifact);

    const paymasterAddress = await paymaster.getAddress();
    console.log(`GeneralPaymaster was deployed to ${paymasterAddress}`);

    // Fund the paymaster
    // We need to send some ETH to the paymaster so it can pay for gas.
    console.log("Funding paymaster with 0.01 ETH...");

    const tx = await wallet.sendTransaction({
        to: paymasterAddress,
        value: ethers.parseEther("0.01"),
    });

    await tx.wait();
    console.log("Paymaster funded!");
}
