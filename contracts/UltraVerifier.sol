// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title UltraVerifier (Mock for MVP)
 * @notice This is a MOCK verifier for MVP testing purposes only
 * @dev WARNING: This mock always returns true! DO NOT use in production!
 *
 * In Noir 1.0+, Solidity verifier generation works differently.
 * For this MVP, we use a mock verifier to test the auction flow.
 *
 * For production:
 * - Use Noir's proof verification in a backend service, OR
 * - Generate verifier using Noir's latest tooling, OR
 * - Use an off-chain proof verification service
 */
contract UltraVerifier {
    /**
     * @notice Mock verification function - ALWAYS RETURNS TRUE
     * @dev This is for testing the auction mechanics only
     * @param proof The ZK proof bytes (unused in mock)
     * @param publicInputs The public inputs (unused in mock)
     * @return true always (MOCK IMPLEMENTATION)
     */
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external pure returns (bool) {
        // MOCK: Always return true for MVP testing
        // In production, this would verify the actual ZK proof
        return true;
    }
}
