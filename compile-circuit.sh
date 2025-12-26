#!/bin/bash

# ZK Auction Circuit Compilation Script
# Run this in WSL after installing Noir

set -e

echo "=== ZK Auction Circuit Compilation ==="
echo ""

# Check if nargo is installed
if ! command -v nargo &> /dev/null; then
    echo "Error: nargo not found!"
    echo "Please install Noir first:"
    echo "  curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash"
    echo "  noirup"
    exit 1
fi

echo "Noir version: $(nargo --version)"
echo ""

# Navigate to circuit directory
cd circuits/bid_proof

# Step 1: Compile the circuit
echo "Step 1: Compiling circuit..."
nargo compile
echo "✓ Circuit compiled"
echo ""

# Step 2: Run tests
echo "Step 2: Running tests..."
nargo test
echo "✓ All tests passed"
echo ""

# Step 3: Copy circuit artifacts to frontend
echo "Step 3: Copying circuit artifacts to frontend..."

# Create frontend circuit directory if it doesn't exist
mkdir -p ../../frontend-simple/circuit

# Copy the compiled circuit
if [ -f "target/bid_proof.json" ]; then
    cp target/bid_proof.json ../../frontend-simple/circuit/
    echo "✓ Circuit JSON copied to frontend"
else
    echo "Error: Compiled circuit not found!"
    exit 1
fi

echo ""
echo "=== Compilation Complete ==="
echo ""
echo "Note: Noir 1.0+ no longer generates Solidity verifiers automatically."
echo "For this MVP, we'll use the contracts with the existing Verifier.sol"
echo ""
echo "Next steps:"
echo "  1. Deploy contracts: npm run deploy:local"
echo "  2. Start frontend: cd frontend-simple && npm run dev"
echo ""
