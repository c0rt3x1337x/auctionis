# Quick Deployment Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Start Local Blockchain

Open a new terminal and run:

```bash
npx hardhat node
```

Keep this running! You'll see 20 accounts with private keys and 10,000 ETH each.

## Step 3: Deploy Contracts

In another terminal:

```bash
npx hardhat run scripts/deploy-simple.js --network localhost
```

You'll see output like:
```
Verifier: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Auction: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

**Copy these addresses!**

## Step 4: Update Frontend

Edit `frontend-simple/app.js` lines 2-5:

```javascript
const CONTRACT_ADDRESSES = {
    auction: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // YOUR AUCTION ADDRESS
    verifier: '0x5FbDB2315678afecb367f032d93F642f64180aa3'  // YOUR VERIFIER ADDRESS
};
```

## Step 5: Start the Auction

```bash
npx hardhat run scripts/start-auction.js --network localhost
```

## Step 6: Setup MetaMask

1. Open MetaMask
2. Add Network:
   - Network Name: `Localhost 8545`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`

3. Import Account:
   - Copy one of the private keys from the Hardhat node terminal
   - In MetaMask: Import Account → Paste private key

## Step 7: Open Frontend

Just open the file directly in your browser:

```
file:///C:/Users/KananHusayn/Documents/Uni/ZKP/Auction/frontend-simple/index.html
```

Or use Live Server in VS Code.

## Step 8: Test!

1. Click "Connect Wallet"
2. Select your imported account
3. Go to "Commit Bid" tab
4. Enter bid amount (e.g., 1000)
5. Enter deposit (e.g., 0.01)
6. Click "Generate Proof & Submit Bid"

Done! The mock verifier will accept any proof, so you can test the full auction flow.

## Troubleshooting

**"insufficient funds"** = Contract addresses not updated or not deployed
**"ethers is not defined"** = Refresh page with Ctrl+Shift+R
**"auction not started"** = Run `npx hardhat run scripts/start-auction.js --network localhost`
