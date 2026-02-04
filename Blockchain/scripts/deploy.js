// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log("\n");

  // ============ Step 1: Deploy TFXToken ============
  console.log("📝 Deploying TFXToken...");
  const TFXToken = await hre.ethers.getContractFactory("TFXToken");
  const tfxToken = await TFXToken.deploy();
  await tfxToken.waitForDeployment();
  const tfxTokenAddress = await tfxToken.getAddress();
  
  console.log("✅ TFXToken deployed to:", tfxTokenAddress);
  console.log("   Token Name: TrustForge Token");
  console.log("   Token Symbol: TFX");
  console.log("   Initial Supply: 1,000,000 TFX");
  console.log("\n");

  // ============ Step 2: Deploy TrustForge ============
  console.log("📝 Deploying TrustForge...");
  const TrustForge = await hre.ethers.getContractFactory("TrustForge");
  const trustForge = await TrustForge.deploy(tfxTokenAddress);
  await trustForge.waitForDeployment();
  const trustForgeAddress = await trustForge.getAddress();
  
  console.log("✅ TrustForge deployed to:", trustForgeAddress);
  console.log("\n");

  // ============ Step 3: Verification Info ============
  console.log("📋 Deployment Summary:");
  console.log("==========================================");
  console.log("TFXToken Address:    ", tfxTokenAddress);
  console.log("TrustForge Address:  ", trustForgeAddress);
  console.log("Deployer Address:    ", deployer.address);
  console.log("==========================================");
  console.log("\n");

  // ============ Step 4: Save Deployment Info ============
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TFXToken: {
        address: tfxTokenAddress,
        name: "TrustForge Token",
        symbol: "TFX"
      },
      TrustForge: {
        address: trustForgeAddress,
        lendingToken: tfxTokenAddress
      }
    }
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Deployment info saved to deployment-info.json\n");

  // ============ Step 5: Verification Commands ============
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("📝 Verification Commands:");
    console.log("==========================================");
    console.log("\nTo verify TFXToken:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${tfxTokenAddress}`);
    console.log("\nTo verify TrustForge:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${trustForgeAddress} ${tfxTokenAddress}`);
    console.log("\n==========================================\n");
  }

  // ============ Step 6: Next Steps ============
  console.log("📌 Next Steps:");
  console.log("==========================================");
  console.log("1. Approve TrustForge to spend TFX tokens (for lenders)");
  console.log("2. Deposit liquidity into the pool using depositToPool()");
  console.log("3. Users can request loans using requestLoan()");
  console.log("4. (Optional) Enable DAO governance using enableDAO()");
  console.log("==========================================\n");

  console.log("🎉 Deployment completed successfully!\n");

  return {
    tfxToken: tfxTokenAddress,
    trustForge: trustForgeAddress
  };
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });