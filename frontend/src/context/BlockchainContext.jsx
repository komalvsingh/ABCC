import { createContext, useContext, useEffect, useState } from "react";
import * as ethers from "ethers";

// Import ABIs
import TFXTokenABI from "../abis/TFXToken.json";
import TrustForgeABI from "../abis/TrustForge.json";

// Addresses (from your deployments)
const TFX_ADDRESS = "0xe8aC27B0B0A257aC40Ec9e99B899CD9d5A2D528B";
const TRUSTFORGE_ADDRESS = "0x236C9dae6369596f9301aFA1Fbb7C3E8613F903e";

const BlockchainContext = createContext();

export const BlockchainProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [tfx, setTfx] = useState(null);
  const [trustForge, setTrustForge] = useState(null);

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const tfxContract = new ethers.Contract(
      TFX_ADDRESS,
      TFXTokenABI.abi,
      signer,
    );

    const trustForgeContract = new ethers.Contract(
      TRUSTFORGE_ADDRESS,
      TrustForgeABI.abi,
      signer,
    );

    setAccount(accounts[0]);
    setProvider(provider);
    setSigner(signer);
    setTfx(tfxContract);
    setTrustForge(trustForgeContract);
  };

  // Auto connect
  useEffect(() => {
    if (window.ethereum) {
      connectWallet();
    }
  }, []);

  /* ----------------- TFX FUNCTIONS ----------------- */

  const getTFXBalance = async () => {
    if (!tfx || !account) return "0";
    const bal = await tfx.balanceOf(account);
    return ethers.formatEther(bal);
  };

  const approveTFX = async (amount) => {
    const tx = await tfx.approve(TRUSTFORGE_ADDRESS, ethers.parseEther(amount));
    await tx.wait();
  };

  /* ----------------- LENDER FUNCTIONS ----------------- */

  const depositToPool = async (amount) => {
    await approveTFX(amount);
    const tx = await trustForge.depositToPool(ethers.parseEther(amount));
    await tx.wait();
  };

  const withdrawFromPool = async (amount) => {
    const tx = await trustForge.withdrawFromPool(ethers.parseEther(amount));
    await tx.wait();
  };

  const claimInterest = async () => {
    const tx = await trustForge.claimInterest();
    await tx.wait();
  };

  /* ----------------- BORROWER FUNCTIONS ----------------- */

  const requestLoan = async (amount) => {
    const tx = await trustForge.requestLoan(ethers.parseEther(amount));
    await tx.wait();
  };

  const repayLoan = async (amount) => {
    await approveTFX(amount);
    const tx = await trustForge.repayLoan();
    await tx.wait();
  };

  /* ----------------- READ FUNCTIONS ----------------- */

  const getUserProfile = async () => {
    return await trustForge.getUserProfile(account);
  };

  const getActiveLoan = async () => {
    return await trustForge.getActiveLoan(account);
  };

  const getPoolStats = async () => {
    return await trustForge.getPoolStats();
  };

  const getLenderInfo = async () => {
    return await trustForge.getLenderInfo(account);
  };

  return (
    <BlockchainContext.Provider
      value={{
        account,
        connectWallet,
        tfx,
        trustForge,
        getTFXBalance,
        depositToPool,
        withdrawFromPool,
        claimInterest,
        requestLoan,
        repayLoan,
        getUserProfile,
        getActiveLoan,
        getPoolStats,
        getLenderInfo,
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = () => useContext(BlockchainContext);
