// Contract addresses - UPDATE THESE after deployment
const CONTRACT_ADDRESSES = {
    auction: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // MultiItemAuction
    verifier: '0x5FbDB2315678afecb367f032d93F642f64180aa3'  // UltraVerifier
};

// Contract ABIs
const AUCTION_ABI = [
    "function createItem(string name, string description, address beneficiary, uint256 minimumDeposit, uint256 commitDuration, uint256 revealDuration) returns (uint256)",
    "function commitBid(uint256 itemId, bytes32 commitment) payable",
    "function revealBid(uint256 itemId, uint256 bidAmount, uint256 secret, bytes proof)",
    "function advancePhase(uint256 itemId)",
    "function withdraw()",
    "function getActiveItems() view returns (uint256[])",
    "function getItem(uint256 itemId) view returns (tuple(uint256 itemId, string name, string description, address creator, address beneficiary, uint256 minimumDeposit, uint256 commitDeadline, uint256 revealDeadline, uint8 currentPhase, uint256 highestBid, address highestBidder, uint256 totalBids, bool exists))",
    "function getCommitment(uint256 itemId, address bidder) view returns (tuple(bytes32 commitment, uint256 deposit, bool revealed, uint256 bidAmount, uint256 timestamp))",
    "function withdrawable(address bidder) view returns (uint256)",
    "function nextItemId() view returns (uint256)",
    "event ItemCreated(uint256 indexed itemId, string name, address beneficiary, uint256 commitDeadline, uint256 revealDeadline)",
    "event BidCommitted(uint256 indexed itemId, address indexed bidder, bytes32 commitment, uint256 deposit)",
    "event BidRevealed(uint256 indexed itemId, address indexed bidder, uint256 bidAmount)",
    "event AuctionFinalized(uint256 indexed itemId, address winner, uint256 winningBid)"
];

// Global state
let provider = null;
let signer = null;
let auctionContract = null;
let userAddress = null;
let selectedItemId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    checkWalletConnection();
}

function setupEventListeners() {
    // Wallet
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet').addEventListener('click', disconnectWallet);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Forms
    document.getElementById('commit-form').addEventListener('submit', handleCommitBid);
    document.getElementById('create-item-form').addEventListener('submit', handleCreateItem);
    document.getElementById('finalize-btn')?.addEventListener('click', handleFinalize);
    document.getElementById('reveal-btn')?.addEventListener('click', handleRevealBid);
    document.getElementById('reveal-item-id')?.addEventListener('change', handleRevealItemSelect);
    document.getElementById('use-my-address')?.addEventListener('click', useMyAddress);
}

function useMyAddress() {
    if (!userAddress) {
        alert('Please connect your wallet first!');
        return;
    }
    document.getElementById('item-beneficiary').value = userAddress;
}

async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet:', error);
        }
    }
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        return;
    }

    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Initialize contract
        auctionContract = new ethers.Contract(CONTRACT_ADDRESSES.auction, AUCTION_ABI, signer);

        // Get balance
        const balance = await provider.getBalance(userAddress);
        const balanceInEth = ethers.utils.formatEther(balance);

        // Update UI
        document.getElementById('connect-wallet').style.display = 'none';
        document.getElementById('account-info').style.display = 'flex';
        document.getElementById('account-address').textContent =
            userAddress.substring(0, 6) + '...' + userAddress.substring(38);
        document.getElementById('account-balance').textContent =
            'Balance: ' + parseFloat(balanceInEth).toFixed(4) + ' ETH';

        // Load items
        await loadAuctionItems();

        // Listen to changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
}

function disconnectWallet() {
    provider = null;
    signer = null;
    auctionContract = null;
    userAddress = null;
    selectedItemId = null;

    document.getElementById('connect-wallet').style.display = 'block';
    document.getElementById('account-info').style.display = 'none';
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        window.location.reload();
    }
}

async function loadAuctionItems() {
    if (!auctionContract) return;

    try {
        const activeItemIds = await auctionContract.getActiveItems();
        const itemsList = document.getElementById('items-list');
        const revealSelector = document.getElementById('reveal-item-id');

        if (activeItemIds.length === 0) {
            itemsList.innerHTML = '<p class="info">No active auction items yet. Create one in the Admin tab!</p>';
            return;
        }

        itemsList.innerHTML = '';
        revealSelector.innerHTML = '<option value="">-- Select Item --</option>';

        for (const itemId of activeItemIds) {
            const item = await auctionContract.getItem(itemId);
            const phases = ['COMMIT', 'REVEAL', 'FINALIZED'];

            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.innerHTML = `
                <h3>${item.name}</h3>
                <p><strong>ID:</strong> ${item.itemId.toString()}</p>
                <p><strong>Description:</strong> ${item.description}</p>
                <p><strong>Phase:</strong> <span class="phase-${phases[item.currentPhase]}">${phases[item.currentPhase]}</span></p>
                <p><strong>Min Deposit:</strong> ${ethers.utils.formatEther(item.minimumDeposit)} ETH</p>
                <p><strong>Commit Deadline:</strong> ${new Date(Number(item.commitDeadline) * 1000).toLocaleString()}</p>
                <p><strong>Reveal Deadline:</strong> ${new Date(Number(item.revealDeadline) * 1000).toLocaleString()}</p>
                ${item.currentPhase === 2 ? `
                    <div class="winner-info">
                        <p><strong>🏆 Winner:</strong> ${item.highestBidder === ethers.constants.AddressZero ? 'No bids' : item.highestBidder}</p>
                        <p><strong>💰 Winning Bid:</strong> ${item.highestBid.toString()} wei</p>
                    </div>
                ` : ''}
                <button onclick="selectItem(${item.itemId})" class="primary">
                    ${item.currentPhase === 0 ? 'Place Bid' : item.currentPhase === 1 ? 'Reveal Bid' : 'View Details'}
                </button>
            `;
            itemsList.appendChild(itemCard);

            // Add to reveal selector
            revealSelector.innerHTML += `<option value="${item.itemId}">${item.name} (ID: ${item.itemId})</option>`;
        }

    } catch (error) {
        console.error('Error loading items:', error);
        document.getElementById('items-list').innerHTML = '<p class="warning">Error loading items. Check console.</p>';
    }
}

window.selectItem = async function(itemId) {
    selectedItemId = itemId;

    try {
        const item = await auctionContract.getItem(itemId);
        const phases = ['COMMIT', 'REVEAL', 'FINALIZED'];

        // Update selected item info
        document.getElementById('selected-item-name').textContent = item.name;
        document.getElementById('selected-item-desc').textContent = item.description;
        document.getElementById('selected-item-phase').textContent = phases[item.currentPhase];
        document.getElementById('selected-item-deposit').textContent = ethers.utils.formatEther(item.minimumDeposit);
        document.getElementById('selected-item-commit-deadline').textContent = new Date(Number(item.commitDeadline) * 1000).toLocaleString();

        document.getElementById('selected-item-info').style.display = 'block';
        document.getElementById('no-item-selected').style.display = 'none';
        document.getElementById('commit-form').style.display = 'block';

        // Set minimum deposit
        document.getElementById('deposit-amount').value = ethers.utils.formatEther(item.minimumDeposit);
        document.getElementById('deposit-amount').min = ethers.utils.formatEther(item.minimumDeposit);

        // Switch to commit tab
        switchTab('commit');

    } catch (error) {
        console.error('Error selecting item:', error);
        alert('Error loading item details');
    }
}

async function handleCommitBid(e) {
    e.preventDefault();

    if (!auctionContract || !selectedItemId) {
        alert('Please select an item first!');
        return;
    }

    const bidAmount = document.getElementById('bid-amount').value;
    const depositAmount = document.getElementById('deposit-amount').value;

    if (!bidAmount || !depositAmount) {
        alert('Please enter both bid amount and deposit!');
        return;
    }

    try {
        // Generate random secret
        const secret = generateSecret();

        // Show status
        document.getElementById('proof-status').style.display = 'block';
        document.getElementById('commit-btn').disabled = true;

        // Generate commitment
        const { commitment, proof } = await generateBidProof(
            BigInt(bidAmount),
            secret,
            userAddress
        );

        // Submit to contract
        const tx = await auctionContract.commitBid(
            selectedItemId,
            commitment,
            { value: ethers.utils.parseEther(depositAmount) }
        );

        document.querySelector('#proof-status .status').textContent = 'Submitting transaction...';
        await tx.wait();

        // Save bid info locally
        saveBidLocally(selectedItemId, bidAmount, secret, commitment);

        // Show success
        document.getElementById('proof-status').style.display = 'none';
        document.getElementById('commit-result').style.display = 'block';
        document.getElementById('commit-tx').textContent = tx.hash.substring(0, 10) + '...';
        document.getElementById('commit-form').style.display = 'none';

        alert('Bid committed successfully!');

    } catch (error) {
        console.error('Error committing bid:', error);
        alert('Failed to commit bid: ' + error.message);
        document.getElementById('proof-status').style.display = 'none';
        document.getElementById('commit-btn').disabled = false;
    }
}

async function handleRevealItemSelect(e) {
    const itemId = e.target.value;
    if (!itemId) {
        document.getElementById('saved-bid-info').style.display = 'none';
        document.getElementById('no-saved-bid').style.display = 'none';
        return;
    }

    const savedBid = getSavedBid(itemId);
    if (savedBid) {
        document.getElementById('saved-amount').textContent = savedBid.amount;
        document.getElementById('saved-commitment').textContent =
            savedBid.commitment.substring(0, 10) + '...' + savedBid.commitment.substring(56);
        document.getElementById('saved-bid-info').style.display = 'block';
        document.getElementById('no-saved-bid').style.display = 'none';
        document.getElementById('reveal-btn').onclick = () => handleRevealBid(itemId);
    } else {
        document.getElementById('saved-bid-info').style.display = 'none';
        document.getElementById('no-saved-bid').style.display = 'block';
    }
}

async function handleRevealBid(itemId) {
    if (!auctionContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const savedBid = getSavedBid(itemId);
    if (!savedBid) {
        alert('No saved bid found!');
        return;
    }

    try {
        document.getElementById('reveal-status').style.display = 'block';
        document.getElementById('reveal-btn').disabled = true;

        // Generate proof for reveal
        const { proof } = await generateBidProof(
            BigInt(savedBid.amount),
            savedBid.secret,
            userAddress
        );

        // Reveal bid
        const tx = await auctionContract.revealBid(
            itemId,
            savedBid.amount,
            savedBid.secret,
            proof
        );

        document.querySelector('#reveal-status .status').textContent = 'Submitting transaction...';
        await tx.wait();

        // Show success
        document.getElementById('reveal-status').style.display = 'none';
        document.getElementById('reveal-result').style.display = 'block';
        document.getElementById('reveal-tx').textContent = tx.hash.substring(0, 10) + '...';
        document.getElementById('saved-bid-info').style.display = 'none';

        alert('Bid revealed successfully!');

    } catch (error) {
        console.error('Error revealing bid:', error);
        alert('Failed to reveal bid: ' + error.message);
        document.getElementById('reveal-status').style.display = 'none';
        document.getElementById('reveal-btn').disabled = false;
    }
}

async function handleCreateItem(e) {
    e.preventDefault();

    if (!auctionContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const name = document.getElementById('item-name').value;
    const description = document.getElementById('item-description').value;
    const beneficiary = document.getElementById('item-beneficiary').value;
    const minDeposit = document.getElementById('item-min-deposit').value;
    const commitDuration = document.getElementById('item-commit-duration').value;
    const revealDuration = document.getElementById('item-reveal-duration').value;

    try {
        const tx = await auctionContract.createItem(
            name,
            description,
            beneficiary,
            ethers.utils.parseEther(minDeposit),
            commitDuration, // Already in seconds
            revealDuration  // Already in seconds
        );

        alert('Creating auction item...');
        await tx.wait();

        alert('Auction item created successfully!');
        document.getElementById('create-item-form').reset();
        await loadAuctionItems();
        switchTab('items');

    } catch (error) {
        console.error('Error creating item:', error);
        alert('Failed to create item: ' + error.message);
    }
}

async function handleFinalize() {
    if (!auctionContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const itemId = document.getElementById('finalize-item-id').value;
    if (!itemId) {
        alert('Please enter an item ID!');
        return;
    }

    try {
        const tx = await auctionContract.advancePhase(itemId);
        alert('Finalizing auction...');
        await tx.wait();

        alert('Auction finalized! Check the item to see the winner.');
        await loadAuctionItems();

    } catch (error) {
        console.error('Error finalizing:', error);
        alert('Failed to finalize: ' + error.message);
    }
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(tabName + '-tab').style.display = 'block';

    // Load data for specific tabs
    if (tabName === 'items') {
        loadAuctionItems();
    } else if (tabName === 'myitems') {
        loadMyItems();
    }
}

async function loadMyItems() {
    if (!auctionContract || !userAddress) {
        document.getElementById('my-items-list').innerHTML = '<p class="warning">Please connect your wallet first.</p>';
        return;
    }

    try {
        const nextId = await auctionContract.nextItemId();
        const myItemsList = document.getElementById('my-items-list');
        let myItems = [];

        // Check all items to find ones created by user
        for (let i = 1; i < nextId; i++) {
            try {
                const item = await auctionContract.getItem(i);
                if (item.creator.toLowerCase() === userAddress.toLowerCase()) {
                    myItems.push(item);
                }
            } catch (e) {
                // Item doesn't exist, skip
            }
        }

        if (myItems.length === 0) {
            myItemsList.innerHTML = '<p class="info">You haven\'t created any auctions yet. Go to "Add Item" to create one!</p>';
            return;
        }

        myItemsList.innerHTML = '';
        const phases = ['COMMIT', 'REVEAL', 'FINALIZED'];

        for (const item of myItems) {
            const now = Math.floor(Date.now() / 1000);
            const commitPassed = now >= item.commitDeadline;
            const revealPassed = now >= item.revealDeadline;

            const itemCard = document.createElement('div');
            itemCard.className = 'item-card my-item-card';
            itemCard.innerHTML = `
                <h3>${item.name}</h3>
                <p><strong>ID:</strong> ${item.itemId.toString()}</p>
                <p><strong>Description:</strong> ${item.description}</p>
                <p><strong>Phase:</strong> <span class="phase-${phases[item.currentPhase]}">${phases[item.currentPhase]}</span></p>
                <p><strong>Total Bids:</strong> ${item.totalBids.toString()} ${item.totalBids == 1 ? 'bid' : 'bids'}</p>
                <p><strong>Commit Deadline:</strong> ${new Date(Number(item.commitDeadline) * 1000).toLocaleString()}</p>
                <p><strong>Reveal Deadline:</strong> ${new Date(Number(item.revealDeadline) * 1000).toLocaleString()}</p>

                ${item.currentPhase === 0 && commitPassed ? `
                    <button onclick="advanceToReveal(${item.itemId})" class="primary">➡️ Start Reveal Phase</button>
                ` : ''}

                ${item.currentPhase === 1 && revealPassed ? `
                    <button onclick="finalizeAuction(${item.itemId})" class="primary">🏆 Finalize & Declare Winner</button>
                ` : ''}

                ${item.currentPhase === 2 ? `
                    <div class="winner-info">
                        <p><strong>🏆 Winner:</strong> ${item.highestBidder === ethers.constants.AddressZero ? 'No bids revealed' : item.highestBidder}</p>
                        <p><strong>💰 Winning Bid:</strong> ${item.highestBid.toString()} wei</p>
                    </div>
                ` : ''}
            `;
            myItemsList.appendChild(itemCard);
        }

    } catch (error) {
        console.error('Error loading my items:', error);
        document.getElementById('my-items-list').innerHTML = '<p class="warning">Error loading your items. Check console.</p>';
    }
}

window.advanceToReveal = async function(itemId) {
    if (!auctionContract) return;

    try {
        const tx = await auctionContract.advancePhase(itemId);
        alert('Moving to reveal phase...');
        await tx.wait();
        alert('✅ Now in REVEAL phase! Bidders can reveal their bids.');
        loadMyItems();
    } catch (error) {
        console.error('Error advancing phase:', error);
        alert('Failed: ' + error.message);
    }
}

window.finalizeAuction = async function(itemId) {
    if (!auctionContract) return;

    try {
        const tx = await auctionContract.advancePhase(itemId);
        alert('Finalizing auction...');
        await tx.wait();
        alert('🎉 Auction finalized! Winner has been declared.');
        loadMyItems();
    } catch (error) {
        console.error('Error finalizing:', error);
        alert('Failed: ' + error.message);
    }
}

// Utility functions
function generateSecret() {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateBidProof(bidAmount, secret, bidderAddress) {
    // Generate commitment hash (mock proof for MVP)
    const commitment = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'address'],
            [bidAmount, BigInt(secret), bidderAddress]
        )
    );
    const proof = '0x';
    return { commitment, proof };
}

function saveBidLocally(itemId, amount, secret, commitment) {
    const itemIdStr = itemId.toString();
    const bidData = {
        itemId: itemIdStr,
        amount,
        secret,
        commitment,
        address: userAddress,
        timestamp: Date.now()
    };
    const key = 'sealed_bid_' + userAddress.toLowerCase() + '_' + itemIdStr;
    localStorage.setItem(key, JSON.stringify(bidData));
}

function getSavedBid(itemId) {
    if (!userAddress) return null;
    const itemIdStr = itemId.toString();
    const key = 'sealed_bid_' + userAddress.toLowerCase() + '_' + itemIdStr;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
}
