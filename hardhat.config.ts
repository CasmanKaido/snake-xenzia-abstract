import { HardhatUserConfig } from "hardhat/config";
import "@matterlabs/hardhat-zksync";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  // ---------- zkSync compiler ----------
  zksolc: {
    version: "1.5.15",               // <-- the exact zksolc version you want
    settings: {
      enableEraVMExtensions: true,   // required for Abstract/zkSync
      optimizer: {
        enabled: true,               // turn on optimizer
        runs: 200,                   // typical value; higher = more aggressive
        viaIR: true,                 // **critical** to avoid “stack‑too‑deep”
      },
    },
  },

  // ---------- EVM Solidity compiler ----------
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        viaIR: true,
      },
    },
  },

  defaultNetwork: "abstractTestnet",
  networks: {
    abstractTestnet: {
      url: "https://api.testnet.abs.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      chainId: 11124,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    abstractMainnet: {
      url: "https://api.mainnet.abs.xyz",
      ethNetwork: "mainnet",
      zksync: true,
      chainId: 2741,
    },
  },

  etherscan: {
    apiKey: {
      abstractTestnet: "TACK2D1RGYX9U7MC31SZWWQ7FCWRYQ96AD",
      abstractMainnet: "IEYKU3EEM5XCD76N7Y7HF9HG7M9ARZ2H4A",
    },
    customChains: [
      {
        network: "abstractTestnet",
        chainId: 11124,
        urls: {
          apiURL: "https://api-sepolia.abscan.org/api",
          browserURL: "https://sepolia.abscan.org/",
        },
      },
      {
        network: "abstractMainnet",
        chainId: 2741,
        urls: {
          apiURL: "https://api.abscan.org/api",
          browserURL: "https://abscan.org/",
        },
      },
    ],
  },
};

export default config;