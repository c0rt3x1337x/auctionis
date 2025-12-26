# ZK Sealed-Bid Auction - Setup Guide

Complete step-by-step guide to set up and run the ZK Sealed-Bid Auction project.

## Prerequisites

- Windows with WSL (Windows Subsystem for Linux)
- Node.js 18+ and npm
- MetaMask browser extension
- Git

## Quick Start

### 1. Install WSL

Open PowerShell as Administrator and run:

```powershell
wsl --install
```

Restart your computer after installation.

### 2. Open WSL

Open WSL terminal (search for "Ubuntu" or "WSL" in Windows Start menu).

Navigate to your project directory:

```bash
cd /mnt/c/Users/KananHusayn/Documents/Uni/ZKP/Auction
```

### 3. Run Setup Script

This will install Noir, Node.js, and all dependencies:

```bash
./setup-wsl.sh
```

### 4. Compile Noir Circuit

This compiles the ZK circuit and generates the verifier contract:

```bash
./compile-circuit.sh
```

This will:
- Compile the Noir circuit
- Run all tests
- Generate the Solidity verifier contract
- Copy artifacts to the frontend

### 5. Install Project Dependencies

Back in Windows (or WSL), install Hardhat dependencies:

```bash
npm install
```

### 6. Start Local Blockchain

In a new terminal:

```bash
npx hardhat node
```

Keep this running. It will show you 20 test accounts with private keys.

### 7. Deploy Contracts

In another terminal:

```bash
npx hardhat run scripts/deploy-simple.js --network localhost
```

This will output contract addresses. Copy these addresses.

### 8. Start the Auction

```bash
npx hardhat run scripts/start-auction.js --network localhost
```

### 9. Configure Frontend

Edit `frontend-simple/app.js` and update the contract addresses:

```javascript
const CONTRACT_ADDRESSES = {
    auction: '0x...', // Address from deployment
    verifier: '0x...' // Address from deployment
};
```

### 10. Start Frontend

```bash
cd frontend-simple
npm install
npm run dev
```

The frontend will open at `http://localhost:3000`

### 11. Connect MetaMask

1. In MetaMask, add a new network:
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

2. Import one of the test accounts from Hardhat node using its private key

3. Click "Connect Wallet" in the frontend

## How to Use the Auction

### Phase 1: Commit Bids (5 minutes)

1. Go to "Commit Bid" tab
2. Enter your bid amount (1 to 4,294,967,295)
3. Enter deposit amount (minimum 0.01 ETH)
4. Click "Generate Proof & Submit Bid"
5. Wait for proof generation (~few seconds)
6. Confirm transaction in MetaMask
7. Your bid details are saved locally

### Phase 2: Reveal Bids (5 minutes)

After the commit phase ends:

1. Go to "Reveal Bid" tab
2. Your saved bid will be shown
3. Click "Reveal This Bid"
4. Wait for proof generation
5. Confirm transaction in MetaMask

### Phase 3: View Results

After reveal phase ends:

1. Go to "Dashboard" tab
2. View all bids and the winner
3. The highest bidder wins!

## Project Structure

```
ZKP/Auction/
├── circuits/bid_proof/        # Noir ZK circuit
│   ├── src/main.nr           # Circuit implementation
│   ├── target/               # Compiled circuit (after compilation)
│   └── contract/             # Generated verifier (after compilation)
│
├── contracts/                 # Solidity smart contracts
│   ├── SealedBidAuction.sol  # Main auction contract
│   ├── UltraVerifier.sol     # Generated verifier (after compilation)
│   └── interfaces/           # Contract interfaces
│
├── frontend-simple/          # Simple HTML/JS frontend
│   ├── index.html           # Main page
│   ├── app.js               # Application logic
│   ├── noir-integration.js  # ZK proof generation
│   └── circuit/             # Circuit artifacts (after compilation)
│
├── scripts/                  # Deployment scripts
│   ├── deploy-simple.js     # Deploy contracts
│   └── start-auction.js     # Start the auction
│
├── compile-circuit.sh        # Circuit compilation script
├── setup-wsl.sh             # WSL setup script
└── SETUP.md                 # This file
```

## Troubleshooting

### WSL Issues

**Problem**: `wsl: command not found`

**Solution**: WSL is not installed. Run `wsl --install` in PowerShell as Administrator.

**Problem**: `bash: ./setup-wsl.sh: Permission denied`

**Solution**: Make the script executable:
```bash
chmod +x setup-wsl.sh compile-circuit.sh
```

### Noir Issues

**Problem**: `nargo: command not found`

**Solution**: Noir is not installed or not in PATH. Run:
```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup
```

**Problem**: Circuit compilation fails

**Solution**: Check that you're in the correct directory and have the latest Noir version:
```bash
cd circuits/bid_proof
nargo --version  # Should be 0.36.0 or higher
nargo compile
```

### Contract Deployment Issues

**Problem**: `Error: Cannot find module 'hardhat'`

**Solution**: Install dependencies:
```bash
npm install
```

**Problem**: Deployment fails with "verifier not found"

**Solution**: Make sure you've compiled the circuit first:
```bash
./compile-circuit.sh
```

The verifier contract should exist at `contracts/UltraVerifier.sol`

### Frontend Issues

**Problem**: Proof generation fails

**Solution**: Make sure circuit artifacts are in place:
```bash
ls frontend-simple/circuit/bid_proof.json
```

If missing, run `./compile-circuit.sh`

**Problem**: "Cannot connect to wallet"

**Solution**:
1. Make sure MetaMask is installed
2. Make sure you're connected to Localhost 8545 network
3. Import a test account from Hardhat node

**Problem**: Transaction fails

**Solution**:
1. Check that contracts are deployed
2. Check that auction is started
3. Check that you're in the correct phase
4. Check MetaMask is on the right network (Localhost 8545)

## Testing

### Test the Circuit

```bash
cd circuits/bid_proof
nargo test
```

All 13+ tests should pass.

### Test the Contracts

```bash
npx hardhat test
```

### Test the Complete Flow

1. Start Hardhat node
2. Deploy contracts
3. Start auction
4. Use frontend to commit a bid
5. Wait for commit phase to end (or modify durations in deploy-simple.js)
6. Use frontend to reveal bid
7. Check results in dashboard

## Development

### Modify Circuit

1. Edit `circuits/bid_proof/src/main.nr`
2. Run `nargo compile` in `circuits/bid_proof/`
3. Run `nargo test` to verify
4. Run `./compile-circuit.sh` to update all artifacts
5. Redeploy contracts

### Modify Contracts

1. Edit contracts in `contracts/`
2. Redeploy: `npx hardhat run scripts/deploy-simple.js --network localhost`
3. Update contract addresses in `frontend-simple/app.js`

### Modify Frontend

1. Edit files in `frontend-simple/`
2. Changes are hot-reloaded automatically (if using `npm run dev`)

## Configuration

### Auction Duration

Edit `scripts/deploy-simple.js`:

```javascript
const commitDuration = 300;  // 5 minutes (in seconds)
const revealDuration = 300;  // 5 minutes (in seconds)
```

### Minimum Deposit

Edit `scripts/deploy-simple.js`:

```javascript
const minimumDeposit = hre.ethers.parseEther("0.01"); // 0.01 ETH
```

### Bid Limits

Edit `circuits/bid_proof/src/main.nr`:

```noir
global MAX_BID_AMOUNT: Field = 4294967295; // 2^32 - 1
global MIN_BID_AMOUNT: Field = 1;
```

Then recompile the circuit.

## Security Notes

- Never commit your private keys or `.env` files
- Always use secure random secrets for bids
- Test thoroughly before deploying to mainnet
- Consider a security audit for production use
- The minimum deposit prevents spam attacks
- Non-revealing bidders forfeit their deposit

## Next Steps

- Deploy to testnet (Sepolia)
- Add more frontend features (bid history, notifications)
- Implement batch proof verification
- Add admin panel for auction management
- Improve UI/UX design

## Support

If you encounter issues:

1. Check this guide carefully
2. Check console logs in browser (F12)
3. Check terminal output for errors
4. Review Noir documentation: https://noir-lang.org/docs
5. Review Hardhat documentation: https://hardhat.org/docs
