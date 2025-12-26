import { expect } from "chai";
import { ethers } from "hardhat";
import { Auction, UltraVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Auction", function () {
  let auction: Auction;
  let verifier: UltraVerifier;
  let owner: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;

  const BIDDING_DURATION = 300; // 5 minutes
  const REVEAL_DURATION = 300; // 5 minutes

  beforeEach(async function () {
    // Get signers
    [owner, bidder1, bidder2, bidder3] = await ethers.getSigners();

    // Deploy Verifier
    const VerifierFactory = await ethers.getContractFactory("UltraVerifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy Auction
    const AuctionFactory = await ethers.getContractFactory("Auction");
    auction = await AuctionFactory.deploy(await verifier.getAddress());
    await auction.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await auction.owner()).to.equal(owner.address);
    });

    it("Should set the right verifier", async function () {
      expect(await auction.verifier()).to.equal(await verifier.getAddress());
    });

    it("Should start in NotStarted state", async function () {
      expect(await auction.state()).to.equal(0); // AuctionState.NotStarted
    });
  });

  describe("Starting Auction", function () {
    it("Should allow owner to start auction", async function () {
      await expect(auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION))
        .to.emit(auction, "AuctionStarted");

      expect(await auction.state()).to.equal(1); // AuctionState.BiddingOpen
    });

    it("Should not allow non-owner to start auction", async function () {
      await expect(
        auction.connect(bidder1).startAuction(BIDDING_DURATION, REVEAL_DURATION)
      ).to.be.revertedWithCustomError(auction, "Unauthorized");
    });

    it("Should not allow starting auction twice", async function () {
      await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
      await expect(
        auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION)
      ).to.be.revertedWithCustomError(auction, "InvalidState");
    });

    it("Should set correct bidding and reveal end times", async function () {
      const tx = await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const blockTime = block!.timestamp;

      expect(await auction.biddingEndTime()).to.equal(blockTime + BIDDING_DURATION);
      expect(await auction.revealEndTime()).to.equal(blockTime + BIDDING_DURATION + REVEAL_DURATION);
    });
  });

  describe("Submitting Bids", function () {
    beforeEach(async function () {
      await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should reject bid when bidding is not open", async function () {
      // Deploy new auction that hasn't started
      const AuctionFactory = await ethers.getContractFactory("Auction");
      const newAuction = await AuctionFactory.deploy(await verifier.getAddress());
      await newAuction.waitForDeployment();

      const commitment = ethers.randomBytes(32);
      const proof = ethers.randomBytes(100);

      await expect(
        newAuction.connect(bidder1).submitBid(commitment, proof)
      ).to.be.revertedWithCustomError(newAuction, "BiddingNotOpen");
    });

    // Note: Testing actual bid submission requires a valid ZK proof
    // This would be implemented once the Noir circuit is compiled and verifier is generated
    it("Should track bidder count", async function () {
      expect(await auction.getBidderCount()).to.equal(0);
    });
  });

  describe("Revealing Bids", function () {
    beforeEach(async function () {
      await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should not allow reveal during bidding period", async function () {
      const amount = 1000;
      const secret = 12345;

      await expect(
        auction.connect(bidder1).revealBid(amount, secret)
      ).to.be.revertedWithCustomError(auction, "RevealPeriodNotOpen");
    });

    it("Should not allow reveal without submitted bid", async function () {
      // Fast forward past bidding period
      await ethers.provider.send("evm_increaseTime", [BIDDING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      const amount = 1000;
      const secret = 12345;

      await expect(
        auction.connect(bidder1).revealBid(amount, secret)
      ).to.be.revertedWithCustomError(auction, "NoBidSubmitted");
    });
  });

  describe("Ending Auction", function () {
    beforeEach(async function () {
      await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should not allow non-owner to end auction", async function () {
      await expect(
        auction.connect(bidder1).endAuction()
      ).to.be.revertedWithCustomError(auction, "Unauthorized");
    });

    it("Should not allow ending auction before reveal period", async function () {
      await expect(
        auction.connect(owner).endAuction()
      ).to.be.revertedWithCustomError(auction, "InvalidState");
    });

    it("Should allow owner to end auction after reveal period", async function () {
      // Fast forward past both bidding and reveal periods
      await ethers.provider.send("evm_increaseTime", [BIDDING_DURATION + REVEAL_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(auction.connect(owner).endAuction())
        .to.emit(auction, "AuctionEnded");

      expect(await auction.state()).to.equal(4); // AuctionState.Ended
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await auction.connect(owner).startAuction(BIDDING_DURATION, REVEAL_DURATION);
    });

    it("Should return empty bidders array initially", async function () {
      const bidders = await auction.getAllBidders();
      expect(bidders.length).to.equal(0);
    });

    it("Should return zero bid details for non-bidder", async function () {
      const [commitment, revealedAmount, revealed] = await auction.getBid(bidder1.address);
      expect(commitment).to.equal(ethers.ZeroHash);
      expect(revealedAmount).to.equal(0);
      expect(revealed).to.equal(false);
    });
  });
});
