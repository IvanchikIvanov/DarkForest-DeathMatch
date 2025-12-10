# Web3 Integration Setup Guide

## Prerequisites

1. Install MetaMask or another Web3 wallet browser extension
2. Get Sepolia testnet ETH from a faucet (e.g., https://sepoliafaucet.com/)
3. Configure your `.env` file (see below)

## Setup Instructions

### 1. Deploy Smart Contract

1. Create a `.env` file in the project root:
```
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
```

2. Deploy the contract to Sepolia:
```bash
npx hardhat run scripts/deploy.cjs --network sepolia
```

3. Copy the deployed contract address and add it to your `.env`:
```
VITE_CONTRACT_ADDRESS=0x...
```

### 2. Build and Run Frontend

```bash
npm run dev
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" button and approve the connection in MetaMask
2. **Create Room**: 
   - Select bet amount (0.001 or 0.005 ETH)
   - Click "CREATE ARENA"
   - Approve the transaction in MetaMask
   - Share the Room ID with your opponent
3. **Join Room**:
   - Enter the Room ID
   - The required bet amount will be displayed
   - Click "JOIN ARENA"
   - Approve the transaction in MetaMask
4. **Play Game**: Once both players join, the host can start the game
5. **Claim Reward**: After winning, click "Claim Reward" to receive your winnings (95% of total bets)

## Smart Contract Details

- **Bet Amounts**: 0.001 ETH or 0.005 ETH
- **Platform Fee**: 5% of total bets
- **Winner Reward**: 95% of total bets (both players' bets combined)

## Network

- **Testnet**: Ethereum Sepolia
- **Chain ID**: 11155111

## Troubleshooting

- Make sure you're connected to Sepolia testnet in MetaMask
- Ensure you have enough Sepolia ETH for gas fees and bets
- Check that `VITE_CONTRACT_ADDRESS` is set correctly in your `.env` file
- Verify the contract is deployed and verified on Sepolia

