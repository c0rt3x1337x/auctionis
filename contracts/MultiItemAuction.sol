// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IUltraVerifier.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MultiItemAuction
 * @notice Simple multi-item sealed-bid auction (MVP)
 * @dev Simplified version supporting multiple auction items
 */
contract MultiItemAuction is ReentrancyGuard, Ownable {
    // Auction phases
    enum AuctionPhase { COMMIT, REVEAL, FINALIZED }

    // Item structure
    struct AuctionItem {
        uint256 itemId;
        string name;
        string description;
        address creator;
        address beneficiary;
        uint256 minimumDeposit;
        uint256 commitDeadline;
        uint256 revealDeadline;
        AuctionPhase currentPhase;
        uint256 highestBid;
        address highestBidder;
        uint256 totalBids;
        bool exists;
    }

    // Bid commitment structure
    struct Commitment {
        bytes32 commitment;
        uint256 deposit;
        bool revealed;
        uint256 bidAmount;
        uint256 timestamp;
    }

    // State variables
    IUltraVerifier public immutable verifier;
    uint256 public nextItemId;

    // itemId => AuctionItem
    mapping(uint256 => AuctionItem) public items;

    // itemId => bidder => Commitment
    mapping(uint256 => mapping(address => Commitment)) public commitments;

    // bidder => withdrawable amount
    mapping(address => uint256) public withdrawable;

    // Events
    event ItemCreated(uint256 indexed itemId, string name, address beneficiary, uint256 commitDeadline, uint256 revealDeadline);
    event BidCommitted(uint256 indexed itemId, address indexed bidder, bytes32 commitment, uint256 deposit);
    event BidRevealed(uint256 indexed itemId, address indexed bidder, uint256 bidAmount);
    event AuctionFinalized(uint256 indexed itemId, address winner, uint256 winningBid);
    event FundsWithdrawn(address indexed bidder, uint256 amount);

    constructor(address _verifier) Ownable(msg.sender) {
        require(_verifier != address(0), "Invalid verifier");
        verifier = IUltraVerifier(_verifier);
        nextItemId = 1;
    }

    /**
     * @notice Create a new auction item
     */
    function createItem(
        string calldata name,
        string calldata description,
        address beneficiary,
        uint256 minimumDeposit,
        uint256 commitDuration,
        uint256 revealDuration
    ) external returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(minimumDeposit > 0, "Invalid deposit");
        require(commitDuration > 0 && revealDuration > 0, "Invalid duration");

        uint256 itemId = nextItemId++;
        uint256 commitDeadline = block.timestamp + commitDuration;
        uint256 revealDeadline = commitDeadline + revealDuration;

        items[itemId] = AuctionItem({
            itemId: itemId,
            name: name,
            description: description,
            creator: msg.sender,
            beneficiary: beneficiary,
            minimumDeposit: minimumDeposit,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            currentPhase: AuctionPhase.COMMIT,
            highestBid: 0,
            highestBidder: address(0),
            totalBids: 0,
            exists: true
        });

        emit ItemCreated(itemId, name, beneficiary, commitDeadline, revealDeadline);
        return itemId;
    }

    /**
     * @notice Commit a bid for specific item
     */
    function commitBid(uint256 itemId, bytes32 commitment)
        external
        payable
        nonReentrant
    {
        AuctionItem storage item = items[itemId];
        require(item.exists, "Item does not exist");
        require(item.currentPhase == AuctionPhase.COMMIT, "Not in commit phase");
        require(block.timestamp < item.commitDeadline, "Commit deadline passed");
        require(msg.value >= item.minimumDeposit, "Insufficient deposit");
        require(commitments[itemId][msg.sender].commitment == bytes32(0), "Already committed");
        require(commitment != bytes32(0), "Invalid commitment");

        commitments[itemId][msg.sender] = Commitment({
            commitment: commitment,
            deposit: msg.value,
            revealed: false,
            bidAmount: 0,
            timestamp: block.timestamp
        });

        // Increment total bids counter
        item.totalBids++;

        emit BidCommitted(itemId, msg.sender, commitment, msg.value);
    }

    /**
     * @notice Reveal bid with proof
     */
    function revealBid(
        uint256 itemId,
        uint256 bidAmount,
        uint256 secret,
        bytes calldata proof
    ) external nonReentrant {
        AuctionItem storage item = items[itemId];
        require(item.exists, "Item does not exist");
        require(item.currentPhase == AuctionPhase.REVEAL, "Not in reveal phase");
        require(block.timestamp < item.revealDeadline, "Reveal deadline passed");

        Commitment storage commitment = commitments[itemId][msg.sender];
        require(commitment.commitment != bytes32(0), "No commitment found");
        require(!commitment.revealed, "Already revealed");

        // For MVP: simplified proof verification (mock verifier returns true)
        // In production, verify the actual ZK proof here

        // Mark as revealed
        commitment.revealed = true;
        commitment.bidAmount = bidAmount;

        // Update highest bid
        if (bidAmount > item.highestBid) {
            // Previous highest bidder gets refund
            if (item.highestBidder != address(0)) {
                withdrawable[item.highestBidder] += commitments[itemId][item.highestBidder].deposit;
            }

            item.highestBid = bidAmount;
            item.highestBidder = msg.sender;
        } else {
            // Losing bidder gets refund
            withdrawable[msg.sender] += commitment.deposit;
        }

        emit BidRevealed(itemId, msg.sender, bidAmount);
    }

    /**
     * @notice Advance item auction to next phase
     */
    function advancePhase(uint256 itemId) external {
        AuctionItem storage item = items[itemId];
        require(item.exists, "Item does not exist");

        if (item.currentPhase == AuctionPhase.COMMIT) {
            require(block.timestamp >= item.commitDeadline, "Commit phase not ended");
            item.currentPhase = AuctionPhase.REVEAL;
        } else if (item.currentPhase == AuctionPhase.REVEAL) {
            require(block.timestamp >= item.revealDeadline, "Reveal phase not ended");
            item.currentPhase = AuctionPhase.FINALIZED;
            _finalizeItem(itemId);
        }
    }

    /**
     * @notice Finalize specific item auction
     */
    function _finalizeItem(uint256 itemId) private {
        AuctionItem storage item = items[itemId];

        if (item.highestBidder != address(0)) {
            uint256 winnerDeposit = commitments[itemId][item.highestBidder].deposit;

            // Transfer winner's deposit to beneficiary
            (bool success, ) = item.beneficiary.call{value: winnerDeposit}("");
            require(success, "Transfer failed");
        }

        emit AuctionFinalized(itemId, item.highestBidder, item.highestBid);
    }

    /**
     * @notice Withdraw available funds
     */
    function withdraw() external nonReentrant {
        uint256 amount = withdrawable[msg.sender];
        require(amount > 0, "No funds to withdraw");

        withdrawable[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Get all active items
     */
    function getActiveItems() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextItemId; i++) {
            if (items[i].exists && items[i].currentPhase != AuctionPhase.FINALIZED) {
                count++;
            }
        }

        uint256[] memory activeItems = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextItemId; i++) {
            if (items[i].exists && items[i].currentPhase != AuctionPhase.FINALIZED) {
                activeItems[index++] = i;
            }
        }

        return activeItems;
    }

    /**
     * @notice Get item details
     */
    function getItem(uint256 itemId) external view returns (AuctionItem memory) {
        require(items[itemId].exists, "Item does not exist");
        return items[itemId];
    }

    /**
     * @notice Get commitment for specific item and bidder
     */
    function getCommitment(uint256 itemId, address bidder) external view returns (Commitment memory) {
        return commitments[itemId][bidder];
    }

    receive() external payable {
        revert("Use commitBid()");
    }

    fallback() external payable {
        revert("Function does not exist");
    }
}
