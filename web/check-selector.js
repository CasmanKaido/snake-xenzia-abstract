import { getGeneralPaymasterInput } from "viem/zksync";
import { keccak256, toBytes } from "viem";

function getSelector(signature) {
    return keccak256(toBytes(signature)).slice(0, 10);
}

async function main() {
    const input = getGeneralPaymasterInput({ innerInput: '0x' });
    console.log("Viem Output:", input);

    const selectorViem = input.slice(0, 10);
    console.log("Viem Selector:", selectorViem);

    const sig1 = "general(bytes)";
    const sel1 = getSelector(sig1);
    console.log(`Selector for ${sig1}: ${sel1}`);

    const sig2 = "general()";
    const sel2 = getSelector(sig2);
    console.log(`Selector for ${sig2}: ${sel2}`);
}

main();
