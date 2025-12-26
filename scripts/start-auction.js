const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== Starting Auction ===\n");

  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.error("Error: Deployment file not found!");
    console.error("Please deploy contracts first: npx hardhat run scripts/deploy-simple.js --network", hre.network.name);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const auctionAddress = deployment.contracts.auction;

  console.log("Network:", hre.network.name);
  console.log("Auction Address:", auctionAddress, "\n");

  // Get auction contract
  const auction = await hre.ethers.getContractAt("SealedBidAuction", auctionAddress);

  // Check current phase
  const currentPhase = await auction.currentPhase();
  console.log("Current Phase:", currentPhase);

  if (currentPhase !== 0n) {
    console.log("Auction already started!");

    const commitDeadline = await auction.commitDeadline();
    const revealDeadline = await auction.revealDeadline();

    console.log("\nAuction Timeline:");
    console.log("  Commit Deadline:", new Date(Number(commitDeadline) * 1000).toLocaleString());
    console.log("  Reveal Deadline:", new Date(Number(revealDeadline) * 1000).toLocaleString());

    return;
  }

  // Start the auction
  console.log("Starting auction...");
  const tx = await auction.startAuction();
  await tx.wait();

  console.log("✓ Auction started!\n");

  // Get auction info
  const commitDeadline = await auction.commitDeadline();
  const revealDeadline = await auction.revealDeadline();

  console.log("Auction Timeline:");
  console.log("  Started:", new Date().toLocaleString());
  console.log("  Commit Deadline:", new Date(Number(commitDeadline) * 1000).toLocaleString());
  console.log("  Reveal Deadline:", new Date(Number(revealDeadline) * 1000).toLocaleString());
  console.log("\nAuction is now open for bids!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
