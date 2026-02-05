import { createContext, useContext, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";

// Import ABIs
import TFXTokenABI from "../abis/TFXToken.json";
import TrustForgeABI from "../abis/TrustForge.json";

// Addresses (from your deployments)
const TFX_ADDRESS = "0x3BfC9C9A6BA115223283ffA1a1CdE90a9D6e187b";
const TRUSTFORGE_ADDRESS = "0x463942083D67Fe0fF490D6Bd1F4c6e671c0C309a";

const BlockchainContext = createContext();

export const BlockchainProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [tfx, setTfx] = useState(null);
  const [trustForge, setTrustForge] = useState(null);
  const [loading, setLoading] = useState(false);

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use this application");
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Handle both ABI formats: {abi: [...]} or just [...]
      const tfxABI = TFXTokenABI.abi || TFXTokenABI;
      const trustForgeABI = TrustForgeABI.abi || TrustForgeABI;

      const tfxContract = new Contract(
        TFX_ADDRESS,
        tfxABI,
        signer
      );

      const trustForgeContract = new Contract(
        TRUSTFORGE_ADDRESS,
        trustForgeABI,
        signer
      );

      setAccount(accounts[0]);
      setProvider(provider);
      setSigner(signer);
      setTfx(tfxContract);
      setTrustForge(trustForgeContract);
      
      console.log("Wallet connected:", accounts[0]);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setTfx(null);
    setTrustForge(null);
  };

  // Auto connect on mount
  useEffect(() => {
    const autoConnect = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts.length > 0) {
            await connectWallet();
          }
        } catch (error) {
          console.error("Auto-connect failed:", error);
        }
      }
    };
    autoConnect();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          connectWallet();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  /* ===================================================================
     TFX TOKEN FUNCTIONS
     =================================================================== */

  const getTFXBalance = async () => {
    if (!tfx || !account) return "0";
    try {
      const bal = await tfx.balanceOf(account);
      return formatEther(bal);
    } catch (error) {
      console.error("Error getting TFX balance:", error);
      return "0";
    }
  };

  const approveTFX = async (amount) => {
    if (!tfx) throw new Error("TFX contract not initialized");
    try {
      const tx = await tfx.approve(TRUSTFORGE_ADDRESS, parseEther(amount));
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error approving TFX:", error);
      throw error;
    }
  };

  const getTFXAllowance = async () => {
    if (!tfx || !account) return "0";
    try {
      const allowance = await tfx.allowance(account, TRUSTFORGE_ADDRESS);
      return formatEther(allowance);
    } catch (error) {
      console.error("Error getting allowance:", error);
      return "0";
    }
  };

  /* ===================================================================
     LENDER FUNCTIONS
     =================================================================== */

  const depositToPool = async (amount) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      await approveTFX(amount);
      const tx = await trustForge.depositToPool(parseEther(amount));
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error depositing to pool:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const withdrawFromPool = async (amount) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.withdrawFromPool(parseEther(amount));
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error withdrawing from pool:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const claimInterest = async () => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.claimInterest();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error claiming interest:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================================
     BORROWER FUNCTIONS
     =================================================================== */

  const requestLoan = async (amount) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.requestLoan(parseEther(amount));
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error requesting loan:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const repayLoan = async () => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const loan = await trustForge.getActiveLoan(account);
      const totalRepayment = formatEther(loan.totalRepayment);
      await approveTFX(totalRepayment);
      const tx = await trustForge.repayLoan();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error repaying loan:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const markDefault = async (borrowerAddress) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.markDefault(borrowerAddress);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error marking default:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================================
     TRUST & SOCIAL FUNCTIONS
     =================================================================== */

  const vouchForUser = async (voucheeAddress) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.vouchForUser(voucheeAddress);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error vouching for user:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const hasVouched = async (voucherAddress, voucheeAddress) => {
    if (!trustForge) return false;
    try {
      return await trustForge.vouches(voucherAddress, voucheeAddress);
    } catch (error) {
      console.error("Error checking vouch:", error);
      return false;
    }
  };

  /* ===================================================================
     READ/VIEW FUNCTIONS
     =================================================================== */

  const getUserProfile = async (address) => {
    if (!trustForge) return null;
    try {
      const userAddress = address || account;
      const profile = await trustForge.getUserProfile(userAddress);
      return {
        trustScore: profile.trustScore.toString(),
        totalLoansTaken: profile.totalLoansTaken.toString(),
        successfulRepayments: profile.successfulRepayments.toString(),
        defaults: profile.defaults.toString(),
        hasActiveLoan: profile.hasActiveLoan,
        walletAge: profile.walletAge.toString(),
        maturityLevel: profile.maturityLevel.toString(),
        maxBorrowingLimit: formatEther(profile.maxBorrowingLimit),
      };
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  };

  const getActiveLoan = async (address) => {
    if (!trustForge) return null;
    try {
      const userAddress = address || account;
      const loan = await trustForge.getActiveLoan(userAddress);
      return {
        principal: formatEther(loan.principal),
        interestAmount: formatEther(loan.interestAmount),
        totalRepayment: formatEther(loan.totalRepayment),
        dueDate: loan.dueDate.toString(),
        status: loan.status,
        isOverdue: loan.isOverdue,
      };
    } catch (error) {
      console.error("Error getting active loan:", error);
      return null;
    }
  };

  const getWalletMaturity = async (address) => {
    if (!trustForge) return null;
    try {
      const userAddress = address || account;
      const maturity = await trustForge.getWalletMaturity(userAddress);
      return {
        age: maturity.age.toString(),
        maturityLevel: maturity.maturityLevel.toString(),
        maturityMultiplier: maturity.maturityMultiplier.toString(),
      };
    } catch (error) {
      console.error("Error getting wallet maturity:", error);
      return null;
    }
  };

  const getPoolStats = async () => {
    if (!trustForge) return null;
    try {
      const stats = await trustForge.getPoolStats();
      return {
        totalLiquidity: formatEther(stats.totalLiquidity),
        totalActiveLoanAmount: formatEther(stats.totalActiveLoanAmount),
        availableLiquidity: formatEther(stats.availableLiquidity),
        utilizationRate: stats.utilizationRate.toString(),
        interestPool: formatEther(stats.interestPool),
        totalDefaulted: formatEther(stats.totalDefaulted),
      };
    } catch (error) {
      console.error("Error getting pool stats:", error);
      return null;
    }
  };

  const getLenderInfo = async (address) => {
    if (!trustForge) return null;
    try {
      const lenderAddress = address || account;
      const info = await trustForge.getLenderInfo(lenderAddress);
      return {
        depositedAmount: formatEther(info.depositedAmount),
        totalInterestEarned: formatEther(info.totalInterestEarned),
        pendingInterest: formatEther(info.pendingInterest),
      };
    } catch (error) {
      console.error("Error getting lender info:", error);
      return null;
    }
  };

  const getDAOInfo = async () => {
    if (!trustForge) return null;
    try {
      const info = await trustForge.getDAOInfo();
      return {
        enabled: info.enabled,
        dao: info.dao,
        trustIncrease: info.trustIncrease.toString(),
        trustDecrease: info.trustDecrease.toString(),
        baseRate: info.baseRate.toString(),
        maxRate: info.maxRate.toString(),
        loanDuration: info.loanDuration.toString(),
      };
    } catch (error) {
      console.error("Error getting DAO info:", error);
      return null;
    }
  };

  const getConstants = async () => {
    if (!trustForge) return null;
    try {
      const [
        initialTrustScore,
        maxTrustScore,
        maturityLevel1,
        maturityLevel2,
        maturityLevel3,
        minLoanAmount,
      ] = await Promise.all([
        trustForge.INITIAL_TRUST_SCORE(),
        trustForge.MAX_TRUST_SCORE(),
        trustForge.MATURITY_LEVEL_1(),
        trustForge.MATURITY_LEVEL_2(),
        trustForge.MATURITY_LEVEL_3(),
        trustForge.MIN_LOAN_AMOUNT(),
      ]);

      return {
        initialTrustScore: initialTrustScore.toString(),
        maxTrustScore: maxTrustScore.toString(),
        maturityLevel1: maturityLevel1.toString(),
        maturityLevel2: maturityLevel2.toString(),
        maturityLevel3: maturityLevel3.toString(),
        minLoanAmount: formatEther(minLoanAmount),
      };
    } catch (error) {
      console.error("Error getting constants:", error);
      return null;
    }
  };

  /* ===================================================================
     ADMIN FUNCTIONS
     =================================================================== */

  const enableDAO = async (daoAddress) => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.enableDAO(daoAddress);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error enabling DAO:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const pauseContract = async () => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.pause();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error pausing contract:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const unpauseContract = async () => {
    if (!trustForge) throw new Error("TrustForge contract not initialized");
    try {
      setLoading(true);
      const tx = await trustForge.unpause();
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Error unpausing contract:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockchainContext.Provider
      value={{
        account,
        provider,
        signer,
        tfx,
        trustForge,
        loading,
        connectWallet,
        disconnectWallet,
        getTFXBalance,
        approveTFX,
        getTFXAllowance,
        depositToPool,
        withdrawFromPool,
        claimInterest,
        requestLoan,
        repayLoan,
        markDefault,
        vouchForUser,
        hasVouched,
        getUserProfile,
        getActiveLoan,
        getWalletMaturity,
        getPoolStats,
        getLenderInfo,
        getDAOInfo,
        getConstants,
        enableDAO,
        pauseContract,
        unpauseContract,
        TFX_ADDRESS,
        TRUSTFORGE_ADDRESS,
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = () => {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error("useBlockchain must be used within BlockchainProvider");
  }
  return context;
};