# Quick Start Guide

Get the ZK Auction running in 5 minutes.

## Step 1: Install WSL (Windows PowerShell as Admin)

```powershell
wsl --install
```

Restart computer.

## Step 2: Setup in WSL

```bash
cd /mnt/c/Users/KananHusayn/Documents/Uni/ZKP/Auction
./setup-wsl.sh
./compile-circuit.sh
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start Blockchain (Terminal 1)

```bash
npx hardhat node
```

## Step 5: Deploy (Terminal 2)

```bash
npx hardhat run scripts/deploy-simple.js --network localhost
npx hardhat run scripts/start-auction.js --network localhost
```

Copy the contract addresses.

## Step 6: Update Frontend

Edit `frontend-simple/app.js` line 2-5:

```javascript
const CONTRACT_ADDRESSES = {
    auction: '0xYOUR_AUCTION_ADDRESS',
    verifier: '0xYOUR_VERIFIER_ADDRESS'
};
```

## Step 7: Start Frontend

```bash
cd frontend-simple
npm install
npm run dev
```

## Step 8: Connect MetaMask

1. Add network: http://127.0.0.1:8545, Chain ID: 31337
2. Import test account from Hardhat node
3. Connect wallet in the app

## Done!

Now you can:
- Commit bids in "Commit Bid" tab
- Reveal bids in "Reveal Bid" tab (after commit phase)
- View results in "Dashboard" tab

## File Overview

| File | Purpose |
|------|---------|
| `circuits/bid_proof/src/main.nr` | ZK circuit (Noir) |
| `contracts/SealedBidAuction.sol` | Main auction contract |
| `frontend-simple/index.html` | Frontend UI |
| `frontend-simple/app.js` | Frontend logic |
| `scripts/deploy-simple.js` | Deployment script |

## Common Commands

```bash
# Compile circuit
./compile-circuit.sh

# Run circuit tests
cd circuits/bid_proof && nargo test

# Run contract tests
npx hardhat test

# Deploy contracts
npx hardhat run scripts/deploy-simple.js --network localhost

# Start auction
npx hardhat run scripts/start-auction.js --network localhost
```

## Need Help?

See [SETUP.md](SETUP.md) for detailed instructions.
