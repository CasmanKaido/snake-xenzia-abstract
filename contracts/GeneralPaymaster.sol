// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/* -------------------------------------------------------------------------- */
/*  BEGIN: Imported interfaces & libraries (flattened)                         */
/* -------------------------------------------------------------------------- */

/* IPaymaster.sol (from @matterlabs/zksync-contracts) */
interface IPaymaster {
    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        returns (bytes4 magic, bytes memory context);

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable;
}

/* IPaymasterFlow.sol (from @matterlabs/zksync-contracts) */
interface IPaymasterFlow {
    function general() external pure returns (bytes4);
}

/* ExecutionResult enum (from system contracts) */
enum ExecutionResult { Success, Revert, RevertToPrev, RevertToPrevAndPay, Fail }

/* Transaction struct (from TransactionHelper.sol) */
struct Transaction {
    address to;
    uint256 value;
    bytes data;
    uint256 gasLimit;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterInput;
    bytes32[4] reserved;
}

/* Constants.sol (only the bootloader address we need) */
address constant BOOTLOADER_FORMAL_ADDRESS = 0x8000000000000000000000000000000000000000;

/* -------------------------------------------------------------------------- */
/*  END: Flattened imports                                                    */
/* -------------------------------------------------------------------------- */

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
        returns (bytes4 magic, bytes memory /*context*/)
    {
        // Accept the transaction by default
        magic = 0xFFFFFFFF; // PAYMASTER_VALIDATION_SUCCESS_MAGIC

        // The paymaster input must be at least the selector (4 bytes)
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        // Directly compare the selector – no temporary variable needed
        if (bytes4(_transaction.paymasterInput[0:4]) == IPaymasterFlow.general.selector) {
            // OPTIONAL: restrict to your game contract only
            // address target = address(uint160(_transaction.to));
            // require(target == YOUR_GAME_CONTRACT_ADDRESS, "Unsupported target");

            // How much ETH is required for the transaction?
            uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

            // Transfer that ETH to the bootloader (the system contract that pays gas)
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: requiredETH}("");
            require(
                success,
                "Failed to transfer tx fee to the Bootloader. Paymaster balance might be too low."
            );
        } else {
            revert("Unsupported paymaster flow");
        }
        // Return magic and an empty context (required by the interface)
        return (magic, new bytes(0));
    }

    function postTransaction(
        bytes calldata,
        Transaction calldata,
        bytes32,
        bytes32,
        ExecutionResult,
        uint256
    ) external payable onlyBootloader {
        // Refunds are not supported for now.
    }

    // Owner‑only withdraw
    function withdraw(address payable _to) external {
        require(msg.sender == owner, "Only owner can withdraw");
        (bool sent, ) = _to.call{value: address(this).balance}("");
        require(sent, "Withdraw failed");
    }

    // Receive ETH
    receive() external payable {}
}
