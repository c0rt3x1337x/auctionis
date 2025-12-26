#!/bin/bash

# WSL Setup Script for ZK Auction Project
# Run this script in WSL to install all dependencies

set -e

echo "=== ZK Auction WSL Setup ==="
echo ""

# Step 1: Install Noir
echo "Step 1: Installing Noir..."

if command -v nargo &> /dev/null; then
    echo "Noir already installed: $(nargo --version)"
else
    echo "Installing noirup..."
    curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash

    # Source the environment
    export PATH="$HOME/.nargo/bin:$PATH"

    echo "Installing Noir..."
    noirup

    # Verify installation
    if command -v nargo &> /dev/null; then
        echo "✓ Noir installed successfully: $(nargo --version)"
    else
        echo "Error: Noir installation failed"
        echo "Please restart your terminal and run 'noirup' manually"
        exit 1
    fi
fi

echo ""

# Step 2: Install Node.js if needed
echo "Step 2: Checking Node.js..."

if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node --version)"
else
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✓ Node.js installed: $(node --version)"
fi

echo ""

# Step 3: Install project dependencies
echo "Step 3: Installing project dependencies..."

# Install root dependencies
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    npm install
    echo "✓ Root dependencies installed"
fi

# Install frontend dependencies
if [ -f "frontend-simple/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd frontend-simple
    npm install
    cd ..
    echo "✓ Frontend dependencies installed"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Compile circuit: ./compile-circuit.sh"
echo "  2. Deploy contracts: npm run deploy:local"
echo "  3. Start frontend: cd frontend-simple && npm run dev"
echo ""
