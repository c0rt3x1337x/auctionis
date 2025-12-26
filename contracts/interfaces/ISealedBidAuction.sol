// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISealedBidAuction
 * @notice Interface for a sealed-bid auction contract with zero-knowledge proof verification
 * @dev Implements a three-phase auction mechanism: COMMIT -> REVEAL -> FINALIZED
 *
 * SECURITY PROPERTIES:
 * - Bid privacy during commit phase (commitments hide bid amounts)
 * - Cryptographic binding (bidders cannot change bids after commit)
 * - Fair reveal mechanism with ZK proof verification
 * - Penalty mechanism for non-revealing bidders
 * - Reentrancy protection for all fund transfers
 * - Time-locked phase transitions to prevent manipulation
 *
 * AUCTION FLOW:
 * 1. COMMIT: Bidders submit commitment hash with optional deposit
 * 2. REVEAL: Bidders reveal bid amount with ZK proof of validity
 * 3. FINALIZED: Highest bidder wins, funds distributed, non-revealers penalized
 */
interface ISealedBidAuction {
    // ============================================================================
    // ENUMS
    // ============================================================================

    /**
     * @notice Auction phases following a strict state machine
     * @dev Phase transitions are irreversible and time-locked
     */
    enum AuctionPhase {
        COMMIT,     // Bidders submit commitments
        REVEAL,     // Bidders reveal bids with ZK proofs
        FINALIZED   // Auction completed, winner determined
    }

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /**
     * @notice Commitment structure storing bid information
     * @param commitment Keccak256 hash or Poseidon commitment from ZK circuit
     * @param deposit Amount of ETH locked with the commitment
     * @param revealed Whether the bidder has revealed their bid
     * @param bidAmount Revealed bid amount (0 if not yet revealed)
     * @param timestamp When the commitment was made
     */
    struct Commitment {
        bytes32 commitment;
        uint256 deposit;
        bool revealed;
        uint256 bidAmount;
        uint256 timestamp;
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    /**
     * @notice Emitted when a bidder commits to a bid
     * @param bidder Address of the bidder
     * @param commitment Hash commitment to the bid
     * @param deposit Amount of ETH deposited
     * @param timestamp Block timestamp of commitment
     */
    event BidCommitted(
        address indexed bidder,
        bytes32 indexed commitment,
        uint256 deposit,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a bidder reveals their bid
     * @param bidder Address of the bidder
     * @param bidAmount Revealed bid amount
     * @param valid Whether the reveal was valid (proof verified)
     * @param timestamp Block timestamp of reveal
     */
    event BidRevealed(
        address indexed bidder,
        uint256 bidAmount,
        bool valid,
        uint256 timestamp
    );

    /**
     * @notice Emitted when the auction phase changes
     * @param oldPhase Previous auction phase
     * @param newPhase New auction phase
     * @param timestamp Block timestamp of phase change
     */
    event PhaseChanged(
        AuctionPhase oldPhase,
        AuctionPhase newPhase,
        uint256 timestamp
    );

    /**
     * @notice Emitted when the auction is finalized
     * @param winner Address of the winning bidder
     * @param winningBid Amount of the winning bid
     * @param timestamp Block timestamp of finalization
     */
    event AuctionFinalized(
        address indexed winner,
        uint256 winningBid,
        uint256 timestamp
    );

    /**
     * @notice Emitted when funds are withdrawn by a bidder
     * @param bidder Address withdrawing funds
     * @param amount Amount withdrawn
     * @param reason Reason for withdrawal (refund, penalty, etc.)
     * @param timestamp Block timestamp of withdrawal
     */
    event FundsWithdrawn(
        address indexed bidder,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when the auction is paused
     * @param operator Address that paused the auction
     * @param timestamp Block timestamp of pause
     */
    event AuctionPaused(address indexed operator, uint256 timestamp);

    /**
     * @notice Emitted when the auction is unpaused
     * @param operator Address that unpaused the auction
     * @param timestamp Block timestamp of unpause
     */
    event AuctionUnpaused(address indexed operator, uint256 timestamp);

    /**
     * @notice Emitted when winning bid payment is transferred to beneficiary
     * @param beneficiary Address receiving the payment
     * @param amount Amount transferred
     * @param timestamp Block timestamp of transfer
     */
    event WinningBidPaid(
        address indexed beneficiary,
        uint256 amount,
        uint256 timestamp
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error InvalidPhase(AuctionPhase current, AuctionPhase required);
    error CommitmentAlreadyExists(address bidder);
    error InsufficientDeposit(uint256 provided, uint256 required);
    error CommitmentNotFound(address bidder);
    error AlreadyRevealed(address bidder);
    error InvalidProof();
    error ProofInputMismatch(string parameter);
    error BidAmountMismatch(uint256 revealed, uint256 proven);
    error CommitmentMismatch(bytes32 stored, bytes32 computed);
    error DeadlinePassed(uint256 deadline, uint256 currentTime);
    error DeadlineNotReached(uint256 deadline, uint256 currentTime);
    error NoWinner();
    error TransferFailed(address recipient, uint256 amount);
    error AuctionPausedError();
    error AuctionNotPaused();
    error Unauthorized(address caller);
    error NoFundsToWithdraw(address bidder);

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get the current auction phase
     * @return Current phase of the auction
     */
    function currentPhase() external view returns (AuctionPhase);

    /**
     * @notice Get the commit phase deadline
     * @return Unix timestamp when commit phase ends
     */
    function commitDeadline() external view returns (uint256);

    /**
     * @notice Get the reveal phase deadline
     * @return Unix timestamp when reveal phase ends
     */
    function revealDeadline() external view returns (uint256);

    /**
     * @notice Get the minimum required deposit
     * @return Minimum deposit amount in wei
     */
    function minimumDeposit() external view returns (uint256);

    /**
     * @notice Get the highest bid amount
     * @return Highest valid revealed bid
     */
    function highestBid() external view returns (uint256);

    /**
     * @notice Get the address of the highest bidder
     * @return Address of current highest bidder
     */
    function highestBidder() external view returns (address);

    /**
     * @notice Get commitment details for a specific bidder
     * @param bidder Address of the bidder
     * @return Commitment struct containing all bid information
     */
    function getCommitment(address bidder) external view returns (Commitment memory);

    /**
     * @notice Check if the auction is paused
     * @return True if paused, false otherwise
     */
    function paused() external view returns (bool);

    /**
     * @notice Get the beneficiary address who receives winning bid
     * @return Address of the beneficiary
     */
    function beneficiary() external view returns (address);

    /**
     * @notice Get withdrawable balance for a bidder
     * @param bidder Address to check
     * @return Amount available for withdrawal
     */
    function withdrawableBalance(address bidder) external view returns (uint256);

    // ============================================================================
    // STATE-CHANGING FUNCTIONS
    // ============================================================================

    /**
     * @notice Submit a commitment to bid
     * @dev Must be called during COMMIT phase with sufficient deposit
     * @param commitment Hash commitment to the bid (from ZK circuit or keccak256)
     */
    function commitBid(bytes32 commitment) external payable;

    /**
     * @notice Reveal a bid with zero-knowledge proof verification
     * @dev Must be called during REVEAL phase by a committed bidder
     * @param bidAmount The bid amount being revealed
     * @param secret The secret nonce used in commitment
     * @param proof ZK proof bytes from Noir circuit
     * @param publicInputs Public inputs array: [commitment, bidder_address]
     */
    function revealBid(
        uint256 bidAmount,
        uint256 secret,
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external;

    /**
     * @notice Advance auction to next phase
     * @dev Can only be called by owner when phase deadline has passed
     */
    function advancePhase() external;

    /**
     * @notice Finalize the auction and determine winner
     * @dev Automatically called when advancing to FINALIZED phase
     */
    function finalize() external;

    /**
     * @notice Withdraw funds (refund for losers, penalty forfeiture for non-revealers)
     * @dev Can be called after auction is finalized
     */
    function withdraw() external;

    /**
     * @notice Emergency pause mechanism
     * @dev Can only be called by owner
     */
    function pause() external;

    /**
     * @notice Unpause the auction
     * @dev Can only be called by owner
     */
    function unpause() external;
}
