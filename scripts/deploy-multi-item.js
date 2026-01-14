const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== ZK Multi-Item Auction Deployment ===\n");

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

  // Step 2: Deploy MultiItemAuction
  console.log("2. Deploying MultiItemAuction...");
  const MultiItemAuction = await hre.ethers.getContractFactory("MultiItemAuction");
  const auction = await MultiItemAuction.deploy(verifierAddress);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("   ✓ MultiItemAuction deployed:", auctionAddress, "\n");

  // Step 3: Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      verifier: verifierAddress,
      auction: auctionAddress
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-multi.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("=== Deployment Complete ===");
  console.log("Deployment info saved to:", deploymentFile);
  console.log("\nContract Addresses:");
  console.log("  Verifier:", verifierAddress);
  console.log("  MultiItemAuction:", auctionAddress);
  console.log("\nNext steps:");
  console.log("  1. Update frontend app.js with these addresses");
  console.log("  2. Create auction items through the Admin panel");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
