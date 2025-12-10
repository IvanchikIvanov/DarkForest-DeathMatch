const hre = require("hardhat");

async function main() {
  console.log("Deploying DuelArena contract...");

  const DuelArena = await hre.ethers.getContractFactory("DuelArena");
  const duelArena = await DuelArena.deploy();

  await duelArena.waitForDeployment();

  const address = await duelArena.getAddress();
  console.log("DuelArena deployed to:", address);
  console.log("\nSave this address to your .env file as CONTRACT_ADDRESS=" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

