# ZK Sealed-Bid Auction

A privacy-preserving sealed-bid auction system built with zero-knowledge proofs using Noir and Ethereum smart contracts.

## Overview

This project implements a sealed-bid auction where bidders can submit bids without revealing their amounts until the reveal phase. Zero-knowledge proofs ensure bid validity without exposing sensitive information.

### Key Features

- **Privacy-Preserving**: Bid amounts remain secret during the bidding phase
- **Zero-Knowledge Proofs**: Noir circuits prove bid validity without revealing details
- **Cryptographic Commitments**: Poseidon hash-based commitments ensure bid integrity
- **Smart Contract Automation**: Ethereum smart contracts manage auction lifecycle
- **Penalty Mechanism**: Non-revealing bidders forfeit their deposits
- **Simple Frontend**: Clean HTML/JS interface for easy interaction

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for a 5-minute setup guide.

For detailed instructions, see [SETUP.md](SETUP.md).

## Project Structure

```
zk-sealed-auction/
├── circuits/bid_proof/        # Noir ZK circuit
│   ├── src/main.nr           # Circuit implementation
│   ├── Nargo.toml            # Circuit configuration
│   └── target/               # Compiled artifacts (generated)
│
├── contracts/                 # Solidity smart contracts
│   ├── SealedBidAuction.sol  # Main auction contract
│   ├── UltraVerifier.sol     # ZK verifier (generated)
│   └── interfaces/           # Contract interfaces
│
├── frontend-simple/          # Simple HTML/JS frontend
│   ├── index.html           # Main UI
│   ├── app.js               # Application logic
│   ├── noir-integration.js  # ZK proof generation
│   └── circuit/             # Circuit artifacts (generated)
│
├── scripts/                  # Deployment and utility scripts
│   ├── deploy-simple.js     # Deploy contracts
│   └── start-auction.js     # Start the auction
│
├── compile-circuit.sh        # Circuit compilation script
├── setup-wsl.sh             # WSL setup script
└── test/                    # Contract tests
```

## How It Works

### 1. Commit Phase

Bidders submit cryptographic commitments to their bids:
- Generate a random secret
- Create commitment: `Poseidon(bid_amount, secret, bidder_address)`
- Generate ZK proof that the bid is valid (within allowed range)
- Submit commitment + proof + deposit to smart contract

### 2. Reveal Phase

Bidders reveal their actual bids:
- Submit the original bid amount and secret
- Generate ZK proof that the reveal matches the commitment
- Smart contract verifies the proof
- Highest bidder is determined

### 3. Finalization

- Winner is declared
- Winner pays their bid amount
- Losing bidders can withdraw their deposits
- Non-revealing bidders forfeit deposits (penalty)

## Technology Stack

- **Zero-Knowledge**: Noir (0.36.0+) with UltraPlonk proving system
- **Smart Contracts**: Solidity 0.8.24 with OpenZeppelin
- **Development**: Hardhat for deployment and testing
- **Frontend**: Vanilla HTML/JavaScript with ethers.js
- **Cryptography**: Poseidon hash for ZK-friendly commitments

## Prerequisites

### Windows Users (Recommended)

- Windows 10/11 with WSL2
- Node.js 18+
- MetaMask browser extension

### Mac/Linux Users

- Node.js 18+
- MetaMask browser extension

## Installation

### 1. Install WSL (Windows only)

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart your computer.

### 2. Setup Project

In WSL (or Linux/Mac terminal):

```bash
cd /mnt/c/Users/KananHusayn/Documents/Uni/ZKP/Auction  # Adjust path

# Run setup script
./setup-wsl.sh

# Compile circuit
./compile-circuit.sh

# Install dependencies
npm install
```

### 3. Deploy Contracts

Start local blockchain:

```bash
npx hardhat node
```

In another terminal:

```bash
npx hardhat run scripts/deploy-simple.js --network localhost
npx hardhat run scripts/start-auction.js --network localhost
```

### 4. Configure Frontend

Update contract addresses in `frontend-simple/app.js`:

```javascript
const CONTRACT_ADDRESSES = {
    auction: '0x...', // From deployment output
    verifier: '0x...'  // From deployment output
};
```

### 5. Start Frontend

```bash
cd frontend-simple
npm install
npm run dev
```

Visit http://localhost:3000

## Usage

### Connect Wallet

1. Install MetaMask
2. Add Localhost network (RPC: http://127.0.0.1:8545, Chain ID: 31337)
3. Import a test account from Hardhat
4. Click "Connect Wallet"

### Submit a Bid

1. Go to "Commit Bid" tab
2. Enter bid amount (1 to 4,294,967,295 wei)
3. Enter deposit (minimum 0.01 ETH)
4. Click "Generate Proof & Submit Bid"
5. Wait for proof generation
6. Confirm transaction in MetaMask

### Reveal Your Bid

After commit phase ends:

1. Go to "Reveal Bid" tab
2. Your saved bid will be shown
3. Click "Reveal This Bid"
4. Confirm transaction in MetaMask

### View Results

1. Go to "Dashboard" tab
2. See all committed and revealed bids
3. View the auction winner

## Testing

### Test Circuit

```bash
cd circuits/bid_proof
nargo test
```

### Test Contracts

```bash
npx hardhat test
```

### Full Integration Test

Follow the usage guide above with multiple test accounts.

## Configuration

### Auction Duration

Edit `scripts/deploy-simple.js`:

```javascript
const commitDuration = 300;  // seconds
const revealDuration = 300;  // seconds
```

### Minimum Deposit

Edit `scripts/deploy-simple.js`:

```javascript
const minimumDeposit = hre.ethers.parseEther("0.01"); // ETH
```

### Bid Range

Edit `circuits/bid_proof/src/main.nr`:

```noir
global MAX_BID_AMOUNT: Field = 4294967295; // 2^32 - 1
global MIN_BID_AMOUNT: Field = 1;
```

Then recompile: `./compile-circuit.sh`

## Security Considerations

- **Commitment Binding**: Each commitment is bound to a specific bidder address
- **Penalty Mechanism**: Non-revealing bidders lose their deposit
- **ZK Proof Verification**: All bids must include valid zero-knowledge proofs
- **Time-Locked Phases**: Phase transitions are time-locked to prevent manipulation
- **Reentrancy Protection**: Smart contracts use ReentrancyGuard
- **Access Control**: Only owner can start auction

## Development

### Circuit Development

1. Edit `circuits/bid_proof/src/main.nr`
2. Test: `cd circuits/bid_proof && nargo test`
3. Compile: `./compile-circuit.sh`
4. Redeploy contracts

### Contract Development

1. Edit contracts in `contracts/`
2. Test: `npx hardhat test`
3. Deploy: `npx hardhat run scripts/deploy-simple.js --network localhost`

### Frontend Development

1. Edit files in `frontend-simple/`
2. Changes hot-reload automatically

## Troubleshooting

See [SETUP.md](SETUP.md) for detailed troubleshooting guide.

## Roadmap

- [x] Noir circuit implementation
- [x] Smart contract development
- [x] Simple frontend
- [x] Local deployment
- [ ] Testnet deployment
- [ ] Enhanced UI/UX
- [ ] Batch proof verification
- [ ] Mobile responsive design
- [ ] Event notifications
- [ ] Admin dashboard

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Resources

- [Noir Documentation](https://noir-lang.org/docs)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Poseidon Hash](https://www.poseidon-hash.info/)

## Support

For issues and questions:
1. Check [SETUP.md](SETUP.md) and [QUICKSTART.md](QUICKSTART.md)
2. Review console logs and error messages
3. Check Noir and Hardhat documentation

## Acknowledgments

- Noir language team for ZK infrastructure
- OpenZeppelin for secure smart contract libraries
- Hardhat team for development tools
