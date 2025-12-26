// Contract addresses - UPDATE THESE after deployment
const CONTRACT_ADDRESSES = {
    auction: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', // Update after deployment
    verifier: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' // Update after deployment
};

// Contract ABIs (minimal versions)
const AUCTION_ABI = [
    "function currentPhase() view returns (uint8)",
    "function commitDeadline() view returns (uint256)",
    "function revealDeadline() view returns (uint256)",
    "function minimumDeposit() view returns (uint256)",
    "function highestBid() view returns (uint256)",
    "function highestBidder() view returns (address)",
    "function commitBid(bytes32 commitment) payable",
    "function revealBid(uint256 bidAmount, uint256 secret, bytes proof)",
    "function getCommitment(address bidder) view returns (bytes32, uint256, bool, uint256)",
    "event CommitmentSubmitted(address indexed bidder, bytes32 commitment, uint256 deposit)",
    "event BidRevealed(address indexed bidder, uint256 bidAmount, bool isValid)"
];

// Global state
let provider = null;
let signer = null;
let auctionContract = null;
let userAddress = null;

// Initialize app
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    checkWalletConnection();
}

function setupEventListeners() {
    // Wallet connection
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet').addEventListener('click', disconnectWallet);

    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Forms
    document.getElementById('commit-form').addEventListener('submit', handleCommitBid);
    document.getElementById('reveal-btn')?.addEventListener('click', handleRevealBid);
    document.getElementById('refresh-dashboard')?.addEventListener('click', refreshDashboard);
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
        alert('Please install MetaMask to use this application!');
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

        // Load auction info
        await loadAuctionInfo();

        // Listen to account changes
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

async function loadAuctionInfo() {
    if (!auctionContract) return;

    try {
        const phase = await auctionContract.currentPhase();
        const commitDeadline = await auctionContract.commitDeadline();
        const revealDeadline = await auctionContract.revealDeadline();
        const minDeposit = await auctionContract.minimumDeposit();

        // Phase names
        const phases = ['Not Started', 'Commit Phase', 'Reveal Phase', 'Finalized'];
        document.getElementById('phase').textContent = phases[Number(phase)];

        // Deadlines
        if (Number(commitDeadline) > 0) {
            document.getElementById('commit-deadline').textContent =
                new Date(Number(commitDeadline) * 1000).toLocaleString();
            document.getElementById('reveal-deadline').textContent =
                new Date(Number(revealDeadline) * 1000).toLocaleString();
        }

        // Minimum deposit
        document.getElementById('min-deposit').textContent = ethers.utils.formatEther(minDeposit);
        document.getElementById('deposit-amount').value = ethers.utils.formatEther(minDeposit);
        document.getElementById('deposit-amount').min = ethers.utils.formatEther(minDeposit);

        // Load results if finalized
        if (Number(phase) === 3) {
            await loadResults();
        }

    } catch (error) {
        console.error('Error loading auction info:', error);
    }
}

async function loadResults() {
    try {
        const highestBid = await auctionContract.highestBid();
        const highestBidder = await auctionContract.highestBidder();

        document.getElementById('highest-bid').textContent = highestBid.toString();
        document.getElementById('highest-bidder').textContent = highestBidder;
        document.getElementById('auction-results').style.display = 'block';
    } catch (error) {
        console.error('Error loading results:', error);
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
    if (tabName === 'reveal') {
        loadSavedBid();
    } else if (tabName === 'dashboard') {
        refreshDashboard();
    }
}

async function handleCommitBid(e) {
    e.preventDefault();

    if (!auctionContract) {
        alert('Please connect your wallet first!');
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

        // Show proof generation status
        document.getElementById('proof-status').style.display = 'block';
        document.getElementById('commit-btn').disabled = true;

        // Generate commitment and proof
        const { commitment, proof } = await generateBidProof(
            BigInt(bidAmount),
            secret,
            userAddress
        );

        // Submit to contract
        const tx = await auctionContract.commitBid(
            commitment,
            { value: ethers.utils.parseEther(depositAmount) }
        );

        document.querySelector('#proof-status .status').textContent = 'Submitting transaction...';
        await tx.wait();

        // Save bid info locally
        saveBidLocally(bidAmount, secret, commitment);

        // Show success
        document.getElementById('proof-status').style.display = 'none';
        document.getElementById('commit-result').style.display = 'block';
        document.getElementById('commit-tx').textContent = tx.hash.substring(0, 10) + '...';
        document.getElementById('commit-form').style.display = 'none';

    } catch (error) {
        console.error('Error committing bid:', error);
        alert('Failed to commit bid: ' + error.message);
        document.getElementById('proof-status').style.display = 'none';
        document.getElementById('commit-btn').disabled = false;
    }
}

async function handleRevealBid() {
    if (!auctionContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const savedBid = getSavedBid();
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

    } catch (error) {
        console.error('Error revealing bid:', error);
        alert('Failed to reveal bid: ' + error.message);
        document.getElementById('reveal-status').style.display = 'none';
        document.getElementById('reveal-btn').disabled = false;
    }
}

function loadSavedBid() {
    const savedBid = getSavedBid();

    if (savedBid) {
        document.getElementById('saved-amount').textContent = savedBid.amount;
        document.getElementById('saved-commitment').textContent =
            savedBid.commitment.substring(0, 10) + '...' + savedBid.commitment.substring(56);
        document.getElementById('saved-bid-info').style.display = 'block';
        document.getElementById('no-saved-bid').style.display = 'none';
    } else {
        document.getElementById('saved-bid-info').style.display = 'none';
        document.getElementById('no-saved-bid').style.display = 'block';
    }
}

async function refreshDashboard() {
    if (!auctionContract) return;

    // This would require reading events from the blockchain
    // For simplicity, we'll just show a message
    alert('Dashboard refresh functionality requires event indexing. Check the browser console for contract events.');
    console.log('To implement dashboard: use ethers.js to query past CommitmentSubmitted and BidRevealed events');
}

// Utility functions
function generateSecret() {
    // Generate a random 32-byte secret
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateBidProof(bidAmount, secret, bidderAddress) {
    // This function will use the Noir circuit to generate a proof
    // For now, it's a placeholder - you'll need to integrate with @noir-lang/noir_js

    console.log('Generating proof for:', { bidAmount, secret, bidderAddress });

    // TODO: Integrate with Noir circuit
    // const noir = await import('./noir-circuit.js');
    // const { proof, publicInputs } = await noir.generateBidProof(bidAmount, secret, bidderAddress);

    // For now, return mock data (simplified for MVP - verifier returns true anyway)
    const commitment = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'address'],
            [bidAmount, BigInt(secret), bidderAddress]
        )
    );

    const proof = '0x'; // This needs to be a real proof from Noir circuit

    return { commitment, proof };
}

function saveBidLocally(amount, secret, commitment) {
    const bidData = {
        amount,
        secret,
        commitment,
        address: userAddress,
        timestamp: Date.now()
    };
    localStorage.setItem('sealed_bid_' + userAddress, JSON.stringify(bidData));
}

function getSavedBid() {
    if (!userAddress) return null;
    const saved = localStorage.getItem('sealed_bid_' + userAddress);
    return saved ? JSON.parse(saved) : null;
}
