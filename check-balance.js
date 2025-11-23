const { Provider } = require("zksync-ethers");
const ethers = require("ethers");

async function main() {
    const provider = new Provider("https://api.testnet.abs.xyz");
    const paymasterAddress = "0xDe2c18B657b3e22f4d014563eB2cF0E37BA84B10";

    const balance = await provider.getBalance(paymasterAddress);
    console.log(`Paymaster Address: ${paymasterAddress}`);
    console.log(`Paymaster Balance: ${ethers.utils.formatEther(balance)} ETH`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
