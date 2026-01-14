# ZK Multi-Item Auction

A decentralized multi-item sealed-bid auction platform using Zero-Knowledge Proofs (ZKP) built with Noir and Solidity.

## Features

- **Multi-Item Auctions**: Create unlimited auction items
- **Zero-Knowledge Proofs**: Bid amounts remain private until reveal phase
- **Sealed-Bid System**: Commit-reveal scheme prevents bid manipulation
- **Phase Management**: Automatic COMMIT → REVEAL → FINALIZED workflow
- **Winner Declaration**: Transparent winner display after auction ends

## Tech Stack

- **Solidity 0.8.24** - Smart contracts
- **Noir** - Zero-knowledge circuits
- **Hardhat** - Development environment
- **ethers.js v5** - Ethereum library
- **Vanilla JavaScript** - Frontend

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask browser extension

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Local Blockchain

```bash
npx hardhat node
```

### 3. Deploy Contracts (new terminal)

```bash
npx hardhat run scripts/deploy-multi-item.js --network localhost
```

### 4. Update Contract Addresses

Copy the deployed addresses from the terminal output and update them in `frontend-simple/app.js`:

```javascript
const CONTRACT_ADDRESSES = {
    auction: '0x...', // MultiItemAuction address
    verifier: '0x...'  // UltraVerifier address
};
```

### 5. Open Frontend

Open `frontend-simple/index.html` in your browser.

### 6. Connect MetaMask

- Add Hardhat network: RPC URL `http://127.0.0.1:8545`, Chain ID `31337`
- Import a test account using private key from Hardhat node output

## How It Works

### Auction Flow

1. **Create Auction** (Add Item tab)
   - Set item name, description, beneficiary
   - Configure bidding and reveal periods

2. **Place Bids** (Browse Items → Place Bid)
   - Enter bid amount and deposit
   - Bid is committed as a hash (hidden)

3. **Advance to Reveal** (My Items tab)
   - After commit deadline, click "Start Reveal Phase"

4. **Reveal Bids** (Reveal Bid tab)
   - Bidders reveal their committed bids

5. **Finalize** (My Items tab)
   - After reveal deadline, click "Finalize & Declare Winner"

### For Sellers

1. Go to **Add Item** tab
2. Fill in auction details
3. Click "Use My Address" for beneficiary
4. Create auction
5. Monitor in **My Items** tab
6. Advance phases when deadlines pass

### For Bidders

1. Browse items in **Browse Items** tab
2. Click "Place Bid" on an item
3. Enter bid amount and deposit
4. Wait for reveal phase
5. Reveal your bid in **Reveal Bid** tab
6. Withdraw deposit if you lose

## Project Structure

```
├── contracts/
│   ├── MultiItemAuction.sol    # Main auction contract
│   ├── UltraVerifier.sol       # ZK proof verifier (mock)
│   └── interfaces/
│       └── IUltraVerifier.sol
├── circuits/
│   └── bid_proof/              # Noir ZK circuits
├── scripts/
│   └── deploy-multi-item.js    # Deployment script
├── frontend-simple/
│   ├── index.html              # Main UI
│   ├── app.js                  # Frontend logic
│   └── styles.css              # Styling
└── hardhat.config.ts           # Hardhat configuration
```

## Security Notes

**This is an MVP for testing/demonstration:**
- Uses mock verifier (always returns true)
- Not audited for production use
- Bids stored in browser localStorage

**For production:**
- Replace mock verifier with real Noir-generated verifier
- Audit smart contracts
- Implement proper ZK proof verification

## License

MIT
