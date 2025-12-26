import { expect } from "chai";
import { ethers } from "hardhat";
import { Auction, UltraVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * Full Integration Test Suite
 *
 * Tests the complete flow of the ZK Sealed-Bid Auction:
 * 1. Contract deployment
 * 2. Auction initialization
 * 3. Multiple bidders submitting commitments with ZK proofs
 * 4. Reveal phase with proof verification
 * 5. Auction finalization and winner determination
 * 6. Edge cases and error handling
 */

describe("Full Integration Test - ZK Sealed-Bid Auction", function () {
  let verifier: UltraVerifier;
  let auction: Auction;
  let owner: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;
  let bidder4: SignerWithAddress;

  const BIDDING_DURATION = 3600; // 1 hour
  const REVEAL_DURATION = 1800; // 30 minutes

  // Mock proof data (in real implementation, these would come from Noir)
  const mockProof = "0x" + "00".repeat(128); // Mock 128-byte proof

  // Helper function to create bid commitment
  function createCommitment(amount: number, secret: number): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [amount, secret]
      )
    );
  }

  beforeEach(async function () {
    // Get signers
    [owner, bidder1, bidder2, bidder3, bidder4] = await ethers.getSigners();

    // Deploy UltraVerifier
    const UltraVerifier = await ethers.getContractFactory("UltraVerifier");
    verifier = await UltraVerifier.deploy();
    await verifier.waitForDeployment();

    // Deploy Auction
    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy(await verifier.getAddress());
    await auction.waitForDeployment();
  });

  describe("1. Deployment and Initialization", function () {
    it("Should deploy contracts with correct initial state", async function () {
      expect(await auction.owner()).to.equal(owner.address);
      expect(await auction.verifier()).to.equal(await verifier.getAddress());
      expect(await auction.state()).to.equal(0); // AuctionState.NotStarted
    });

    it("Should initialize auction with correct parameters", async function () {
      await expect(auction.startAuction(BIDDING_DURATION, REVEAL_DURATION))
        .to.emit(auction, "AuctionStarted")
        .withArgs(
          await time.latest() + BIDDING_DURATION,
          await time.latest() + BIDDING_DURATION + REVEAL_DURATION
        );

      expect(await auction.state()).to.equal(1); // AuctionState.BiddingOpen
    });

    it("Should not allow non-owner to start auction", async function () {
      await expect(
        auction.connect(bidder1).startAuction(BIDDING_DURATION, REVEAL_DURATION)
      ).to.be.revertedWithCustomError(auction, "Unauthorized");
    });

    it("Should not allow starting auction twice", async function () {
      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      await expect(
        auction.startAuction(BIDDING_DURATION, REVEAL_DURATION)
      ).to.be.revertedWithCustomError(auction, "InvalidState");
    });
  });

  describe("2. Bidding Phase", function () {
    beforeEach(async function () {
      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should accept valid bid with commitment and proof", async function () {
      const bidAmount = 1000;
      const secret = 12345;
      const commitment = createCommitment(bidAmount, secret);

      // Note: This test assumes the verifier is mocked or returns true
      // In production, you need to generate real proofs using Noir
      await expect(auction.connect(bidder1).submitBid(commitment, mockProof))
        .to.emit(auction, "BidSubmitted")
        .withArgs(bidder1.address, commitment);

      const bid = await auction.getBid(bidder1.address);
      expect(bid.commitment).to.equal(commitment);
      expect(bid.revealed).to.be.false;
    });

    it("Should handle multiple bidders", async function () {
      const bids = [
        { bidder: bidder1, amount: 1000, secret: 11111 },
        { bidder: bidder2, amount: 1500, secret: 22222 },
        { bidder: bidder3, amount: 1200, secret: 33333 },
      ];

      for (const bid of bids) {
        const commitment = createCommitment(bid.amount, bid.secret);
        await auction.connect(bid.bidder).submitBid(commitment, mockProof);
      }

      expect(await auction.getBidderCount()).to.equal(3);

      const bidders = await auction.getAllBidders();
      expect(bidders).to.have.length(3);
      expect(bidders).to.include(bidder1.address);
      expect(bidders).to.include(bidder2.address);
      expect(bidders).to.include(bidder3.address);
    });

    it("Should reject duplicate bids from same bidder", async function () {
      const commitment = createCommitment(1000, 12345);
      await auction.connect(bidder1).submitBid(commitment, mockProof);

      await expect(
        auction.connect(bidder1).submitBid(commitment, mockProof)
      ).to.be.revertedWithCustomError(auction, "AlreadyBid");
    });

    it("Should reject bids after bidding period ends", async function () {
      // Fast forward past bidding end time
      await time.increase(BIDDING_DURATION + 1);

      const commitment = createCommitment(1000, 12345);
      await expect(
        auction.connect(bidder1).submitBid(commitment, mockProof)
      ).to.be.revertedWithCustomError(auction, "BiddingNotOpen");
    });

    it("Should reject bids with invalid proofs", async function () {
      // This test would need a mock verifier that can reject proofs
      // For now, we document the expected behavior
      // In production, the verifier.verify() call should return false for invalid proofs
    });
  });

  describe("3. Reveal Phase", function () {
    const bid1 = { bidder: null as any, amount: 1000, secret: 11111 };
    const bid2 = { bidder: null as any, amount: 1500, secret: 22222 };
    const bid3 = { bidder: null as any, amount: 1200, secret: 33333 };

    beforeEach(async function () {
      bid1.bidder = bidder1;
      bid2.bidder = bidder2;
      bid3.bidder = bidder3;

      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      // Submit bids
      for (const bid of [bid1, bid2, bid3]) {
        const commitment = createCommitment(bid.amount, bid.secret);
        await auction.connect(bid.bidder).submitBid(commitment, mockProof);
      }

      // Move to reveal phase
      await time.increase(BIDDING_DURATION + 1);
    });

    it("Should accept valid reveals", async function () {
      await expect(
        auction.connect(bidder1).revealBid(bid1.amount, bid1.secret)
      )
        .to.emit(auction, "BidRevealed")
        .withArgs(bidder1.address, bid1.amount);

      const bid = await auction.getBid(bidder1.address);
      expect(bid.revealed).to.be.true;
      expect(bid.revealedAmount).to.equal(bid1.amount);
    });

    it("Should track highest bid correctly", async function () {
      // Reveal in order: 1000, 1500, 1200
      await auction.connect(bidder1).revealBid(bid1.amount, bid1.secret);
      expect(await auction.highestBid()).to.equal(1000);
      expect(await auction.highestBidder()).to.equal(bidder1.address);

      await auction.connect(bidder2).revealBid(bid2.amount, bid2.secret);
      expect(await auction.highestBid()).to.equal(1500);
      expect(await auction.highestBidder()).to.equal(bidder2.address);

      await auction.connect(bidder3).revealBid(bid3.amount, bid3.secret);
      expect(await auction.highestBid()).to.equal(1500);
      expect(await auction.highestBidder()).to.equal(bidder2.address);
    });

    it("Should reject reveals with incorrect secret", async function () {
      await expect(
        auction.connect(bidder1).revealBid(bid1.amount, 99999) // Wrong secret
      ).to.be.revertedWithCustomError(auction, "InvalidReveal");
    });

    it("Should reject reveals with incorrect amount", async function () {
      await expect(
        auction.connect(bidder1).revealBid(9999, bid1.secret) // Wrong amount
      ).to.be.revertedWithCustomError(auction, "InvalidReveal");
    });

    it("Should reject double reveals", async function () {
      await auction.connect(bidder1).revealBid(bid1.amount, bid1.secret);

      await expect(
        auction.connect(bidder1).revealBid(bid1.amount, bid1.secret)
      ).to.be.revertedWithCustomError(auction, "InvalidReveal");
    });

    it("Should reject reveals before bidding ends", async function () {
      // Start new auction
      const Auction = await ethers.getContractFactory("Auction");
      const newAuction = await Auction.deploy(await verifier.getAddress());
      await newAuction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      const commitment = createCommitment(1000, 12345);
      await newAuction.connect(bidder1).submitBid(commitment, mockProof);

      // Try to reveal during bidding phase
      await expect(
        newAuction.connect(bidder1).revealBid(1000, 12345)
      ).to.be.revertedWithCustomError(newAuction, "RevealPeriodNotOpen");
    });

    it("Should reject reveals after reveal period ends", async function () {
      // Fast forward past reveal end time
      await time.increase(REVEAL_DURATION + 1);

      await expect(
        auction.connect(bidder1).revealBid(bid1.amount, bid1.secret)
      ).to.be.revertedWithCustomError(auction, "RevealPeriodNotOpen");
    });

    it("Should handle partial reveals correctly", async function () {
      // Only bidder1 and bidder2 reveal
      await auction.connect(bidder1).revealBid(bid1.amount, bid1.secret);
      await auction.connect(bidder2).revealBid(bid2.amount, bid2.secret);
      // bidder3 does not reveal

      expect(await auction.highestBid()).to.equal(1500);
      expect(await auction.highestBidder()).to.equal(bidder2.address);

      const bid3Data = await auction.getBid(bidder3.address);
      expect(bid3Data.revealed).to.be.false;
    });
  });

  describe("4. Auction Finalization", function () {
    const bid1 = { bidder: null as any, amount: 1000, secret: 11111 };
    const bid2 = { bidder: null as any, amount: 1500, secret: 22222 };

    beforeEach(async function () {
      bid1.bidder = bidder1;
      bid2.bidder = bidder2;

      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      // Submit and reveal bids
      for (const bid of [bid1, bid2]) {
        const commitment = createCommitment(bid.amount, bid.secret);
        await auction.connect(bid.bidder).submitBid(commitment, mockProof);
      }

      await time.increase(BIDDING_DURATION + 1);
      await auction.connect(bidder1).revealBid(bid1.amount, bid1.secret);
      await auction.connect(bidder2).revealBid(bid2.amount, bid2.secret);
      await time.increase(REVEAL_DURATION + 1);
    });

    it("Should end auction and emit event with winner", async function () {
      await expect(auction.endAuction())
        .to.emit(auction, "AuctionEnded")
        .withArgs(bidder2.address, 1500);

      expect(await auction.state()).to.equal(4); // AuctionState.Ended
    });

    it("Should not allow non-owner to end auction", async function () {
      await expect(
        auction.connect(bidder1).endAuction()
      ).to.be.revertedWithCustomError(auction, "Unauthorized");
    });

    it("Should not allow ending before reveal period ends", async function () {
      const Auction = await ethers.getContractFactory("Auction");
      const newAuction = await Auction.deploy(await verifier.getAddress());
      await newAuction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      const commitment = createCommitment(1000, 12345);
      await newAuction.connect(bidder1).submitBid(commitment, mockProof);
      await time.increase(BIDDING_DURATION + 1);
      await newAuction.connect(bidder1).revealBid(1000, 12345);

      // Still in reveal period
      await expect(newAuction.endAuction()).to.be.revertedWithCustomError(
        newAuction,
        "InvalidState"
      );
    });

    it("Should handle auction with no bids", async function () {
      const Auction = await ethers.getContractFactory("Auction");
      const newAuction = await Auction.deploy(await verifier.getAddress());
      await newAuction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      await time.increase(BIDDING_DURATION + REVEAL_DURATION + 1);

      await expect(newAuction.endAuction())
        .to.emit(newAuction, "AuctionEnded")
        .withArgs(ethers.ZeroAddress, 0);
    });
  });

  describe("5. Edge Cases and Error Handling", function () {
    beforeEach(async function () {
      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should handle bidder who never reveals", async function () {
      const commitment1 = createCommitment(1000, 11111);
      const commitment2 = createCommitment(1500, 22222);

      await auction.connect(bidder1).submitBid(commitment1, mockProof);
      await auction.connect(bidder2).submitBid(commitment2, mockProof);

      await time.increase(BIDDING_DURATION + 1);

      // Only bidder2 reveals
      await auction.connect(bidder2).revealBid(1500, 22222);

      await time.increase(REVEAL_DURATION + 1);
      await auction.endAuction();

      // bidder2 should win despite bidder1 potentially having higher bid
      expect(await auction.highestBidder()).to.equal(bidder2.address);
      expect(await auction.highestBid()).to.equal(1500);
    });

    it("Should handle multiple bids with same amount", async function () {
      const amount = 1000;
      const commitment1 = createCommitment(amount, 11111);
      const commitment2 = createCommitment(amount, 22222);

      await auction.connect(bidder1).submitBid(commitment1, mockProof);
      await auction.connect(bidder2).submitBid(commitment2, mockProof);

      await time.increase(BIDDING_DURATION + 1);

      await auction.connect(bidder1).revealBid(amount, 11111);
      await auction.connect(bidder2).revealBid(amount, 22222);

      // First revealer should be highest bidder (since they're equal)
      expect(await auction.highestBid()).to.equal(amount);
      expect(await auction.highestBidder()).to.equal(bidder1.address);
    });

    it("Should prevent reveals from non-bidders", async function () {
      const commitment = createCommitment(1000, 12345);
      await auction.connect(bidder1).submitBid(commitment, mockProof);

      await time.increase(BIDDING_DURATION + 1);

      // bidder2 never submitted a bid
      await expect(
        auction.connect(bidder2).revealBid(1000, 12345)
      ).to.be.revertedWithCustomError(auction, "NoBidSubmitted");
    });

    it("Should maintain state transitions correctly", async function () {
      expect(await auction.state()).to.equal(1); // BiddingOpen

      await time.increase(BIDDING_DURATION + 1);

      const commitment = createCommitment(1000, 12345);
      // Trying to bid after time triggers state change
      await expect(
        auction.connect(bidder1).submitBid(commitment, mockProof)
      ).to.be.revertedWithCustomError(auction, "BiddingNotOpen");

      // Submit bid before time ends
      const newAuction = await (
        await ethers.getContractFactory("Auction")
      ).deploy(await verifier.getAddress());
      await newAuction.startAuction(BIDDING_DURATION, REVEAL_DURATION);
      await newAuction.connect(bidder1).submitBid(commitment, mockProof);

      await time.increase(BIDDING_DURATION + 1);
      await newAuction.connect(bidder1).revealBid(1000, 12345);

      await time.increase(REVEAL_DURATION + 1);
      await newAuction.endAuction();

      expect(await newAuction.state()).to.equal(4); // Ended
    });
  });

  describe("6. Gas Optimization and Performance", function () {
    it("Should handle large number of bidders efficiently", async function () {
      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      // Submit 10 bids
      const signers = await ethers.getSigners();
      const numBidders = Math.min(10, signers.length - 1);

      for (let i = 0; i < numBidders; i++) {
        const commitment = createCommitment(1000 + i * 100, 10000 + i);
        await auction.connect(signers[i + 1]).submitBid(commitment, mockProof);
      }

      expect(await auction.getBidderCount()).to.equal(numBidders);

      // Reveal all bids
      await time.increase(BIDDING_DURATION + 1);

      for (let i = 0; i < numBidders; i++) {
        await auction
          .connect(signers[i + 1])
          .revealBid(1000 + i * 100, 10000 + i);
      }

      // Last bidder should have highest bid
      expect(await auction.highestBid()).to.equal(1000 + (numBidders - 1) * 100);
    });
  });

  describe("7. View Functions and Data Retrieval", function () {
    beforeEach(async function () {
      await auction.startAuction(BIDDING_DURATION, REVEAL_DURATION);

      const bids = [
        { bidder: bidder1, amount: 1000, secret: 11111 },
        { bidder: bidder2, amount: 1500, secret: 22222 },
      ];

      for (const bid of bids) {
        const commitment = createCommitment(bid.amount, bid.secret);
        await auction.connect(bid.bidder).submitBid(commitment, mockProof);
      }
    });

    it("Should return correct bidder count", async function () {
      expect(await auction.getBidderCount()).to.equal(2);
    });

    it("Should return all bidders", async function () {
      const bidders = await auction.getAllBidders();
      expect(bidders).to.have.length(2);
      expect(bidders).to.include(bidder1.address);
      expect(bidders).to.include(bidder2.address);
    });

    it("Should return correct bid details", async function () {
      const commitment = createCommitment(1000, 11111);
      const bid = await auction.getBid(bidder1.address);

      expect(bid.commitment).to.equal(commitment);
      expect(bid.revealed).to.be.false;
      expect(bid.revealedAmount).to.equal(0);
    });

    it("Should update bid details after reveal", async function () {
      await time.increase(BIDDING_DURATION + 1);
      await auction.connect(bidder1).revealBid(1000, 11111);

      const bid = await auction.getBid(bidder1.address);
      expect(bid.revealed).to.be.true;
      expect(bid.revealedAmount).to.equal(1000);
    });
  });
});
