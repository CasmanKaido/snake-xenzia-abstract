# 🚀 Deploy Paymaster Contract to Abstract Testnet

## Step 1: Create Paymaster Contract in Remix

1. **In Remix IDE**, create a new file: `GeneralPaymaster.sol`
2. **Paste the contract code** (see below)

## Step 2: Install Dependencies

The Paymaster contract needs zkSync system contracts. In Remix:

1. Click the **"File Explorer"** icon
2. Create a new file: `.deps/npm/@matterlabs/zksync-contracts/package.json`
3. Or use Remix's built-in dependency manager

**Easier Method**: Use the flattened contract below which includes all dependencies inline.

## Step 3: Compile

1. Go to **"Solidity Compiler"**
2. Select compiler version: `0.8.24` or `0.8.28`
3. Click **"Compile GeneralPaymaster.sol"**

## Step 4: Deploy

1. Go to **"Deploy & Run Transactions"**
2. Environment: **"Injected Provider - MetaMask"**
3. Make sure MetaMask is on **Abstract Testnet**
4. Click **"Deploy"**
5. **Confirm in MetaMask**

## Step 5: Fund the Paymaster

After deployment, you need to send ETH to the Paymaster so it can pay for users' gas:

1. **Copy the deployed Paymaster address**
2. In MetaMask, send **0.01 ETH** (or more) to that address
3. This ETH will be used to sponsor transactions

## Step 6: Update Your React App

1. Open `web/src/App.jsx`
2. Update line 13:
```javascript
const PAYMASTER_ADDRESS = "YOUR_PAYMASTER_ADDRESS_HERE";
```

---

## GeneralPaymaster.sol Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

contract GeneralPaymaster is IPaymaster {
    address public owner;

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            // Note: If you want to restrict this paymaster to ONLY your game contract,
            // you would add a check here:
            // address target = address(uint160(_transaction.to));
            // require(target == YOUR_GAME_CONTRACT_ADDRESS, "Unsupported target");

            // Calculate the required ETH to pay for the transaction
            uint256 requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;

            // Transfer the required ETH to the bootloader
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
                value: requiredETH
            }("");
            require(
                success,
                "Failed to transfer tx fee to the Bootloader. Paymaster balance might be too low."
            );
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader {
        // Refunds are not supported for now.
    }

    function withdraw(address payable _to) external {
        require(msg.sender == owner, "Only owner can withdraw");
        _to.transfer(address(this).balance);
    }

    receive() external payable {}
}
```

---

## Important Notes

⚠️ **The Paymaster contract requires zkSync system contracts**. Remix might have issues importing these.

### Alternative: Use Atlas IDE

If Remix has import issues, try **Atlas IDE** (zkSync's official IDE):
- Go to: https://atlas.zksync.io
- It has built-in support for zkSync contracts
- Follow the same steps as Remix

### Or: Deploy via Hardhat (if we fix the compilation)

Once we resolve the Hardhat compilation issues, you can deploy with:
```bash
npx hardhat deploy-zksync --script deploy_paymaster.ts
```
