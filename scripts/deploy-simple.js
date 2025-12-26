const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== ZK Sealed-Bid Auction Deployment ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Step 1: Deploy UltraVerifier
  console.log("1. Deploying UltraVerifier...");
  const UltraVerifier = await hre.ethers.getContractFactory("UltraVerifier");
  const verifier = await UltraVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   ✓ UltraVerifier deployed:", verifierAddress, "\n");

  // Step 2: Deploy SealedBidAuction
  console.log("2. Deploying SealedBidAuction...");

  // Configuration
  const beneficiary = deployer.address; // Winner's payment goes to deployer
  const minimumDeposit = hre.ethers.parseEther("0.001"); // 0.001 ETH minimum deposit (very low for testing)
  const commitDuration = 300; // 5 minutes for commit phase
  const revealDuration = 300; // 5 minutes for reveal phase

  const SealedBidAuction = await hre.ethers.getContractFactory("SealedBidAuction");
  const auction = await SealedBidAuction.deploy(
    verifierAddress,
    beneficiary,
    minimumDeposit,
    commitDuration,
    revealDuration
  );
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("   ✓ SealedBidAuction deployed:", auctionAddress);
  console.log("   - Beneficiary:", beneficiary);
  console.log("   - Minimum Deposit:", hre.ethers.formatEther(minimumDeposit), "ETH");
  console.log("   - Commit Duration:", commitDuration, "seconds");
  console.log("   - Reveal Duration:", revealDuration, "seconds\n");

  // Step 3: Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      verifier: verifierAddress,
      auction: auctionAddress
    },
    config: {
      beneficiary: beneficiary,
      minimumDeposit: minimumDeposit.toString(),
      commitDuration: commitDuration,
      revealDuration: revealDuration
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("=== Deployment Complete ===");
  console.log("Deployment info saved to:", deploymentFile);
  console.log("\nContract Addresses:");
  console.log("  Verifier:", verifierAddress);
  console.log("  Auction:", auctionAddress);
  console.log("\nNext steps:");
  console.log("  1. Copy these addresses to your frontend configuration");
  console.log("  2. Start the auction with: npx hardhat run scripts/start-auction.js --network", hre.network.name);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
