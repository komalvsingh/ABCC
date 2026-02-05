import { useEffect, useState } from "react";
import { useBlockchain } from "../context/BlockchainContext";

const Lend = () => {
  const {
    account,
    loading,
    connectWallet,
    getTFXBalance,
    depositToPool,
    withdrawFromPool,
    claimInterest,
    getLenderInfo,
    // Faucet functions
    claimTFX,
    canClaimFaucet,
    getFaucetInfo,
  } = useBlockchain();

  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState("0");
  const [lenderInfo, setLenderInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [canClaim, setCanClaim] = useState(false);
  const [faucetInfo, setFaucetInfo] = useState(null);

  // Load balance, lender info & faucet status
  const loadData = async () => {
    try {
      const bal = await getTFXBalance();
      setBalance(bal);

      const info = await getLenderInfo();
      setLenderInfo(info);

      const eligible = await canClaimFaucet();
      setCanClaim(eligible);

      const faucet = await getFaucetInfo();
      setFaucetInfo(faucet);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (account) {
      loadData();
    }
  }, [account]);

  // Deposit TFX
  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid amount");
      return;
    }

    try {
      setMessage("Depositing...");
      await depositToPool(amount);
      setMessage("Deposit successful ✅");
      setAmount("");
      loadData();
    } catch {
      setMessage("Deposit failed ❌");
    }
  };

  // Withdraw TFX
  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter a valid amount");
      return;
    }

    try {
      setMessage("Withdrawing...");
      await withdrawFromPool(amount);
      setMessage("Withdrawal successful ✅");
      setAmount("");
      loadData();
    } catch {
      setMessage("Withdrawal failed ❌");
    }
  };

  // Claim Interest
  const handleClaimInterest = async () => {
    try {
      setMessage("Claiming interest...");
      await claimInterest();
      setMessage("Interest claimed ✅");
      loadData();
    } catch {
      setMessage("Claim failed ❌");
    }
  };

  // Claim TFX from Faucet
  const handleClaimTFX = async () => {
    try {
      setMessage("Claiming TFX from faucet...");
      await claimTFX();
      setMessage("TFX claimed successfully ✅");
      loadData();
    } catch {
      setMessage("Faucet claim failed ❌ (cooldown active?)");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "auto" }}>
      <h1>💰 Lend on TrustForge</h1>

      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p><strong>Wallet:</strong> {account}</p>
          <p><strong>TFX Balance:</strong> {balance}</p>

          {/* Faucet Section */}
          <hr />
          <h3>🚰 Claim Test TFX</h3>

          {faucetInfo && (
            <p>
              Faucet gives <strong>{faucetInfo.faucetAmount} TFX</strong> per claim
            </p>
          )}

          <button
            onClick={handleClaimTFX}
            disabled={!canClaim || loading}
          >
            {canClaim ? "Claim TFX" : "Cooldown Active ⏳"}
          </button>

          <hr />

          {/* Lend / Withdraw */}
          <h3>Lend / Withdraw</h3>
          <input
            type="number"
            placeholder="Amount in TFX"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div style={{ marginTop: "10px" }}>
            <button onClick={handleDeposit} disabled={loading}>
              Deposit
            </button>
            <button
              onClick={handleWithdraw}
              disabled={loading}
              style={{ marginLeft: "10px" }}
            >
              Withdraw
            </button>
          </div>

          <hr />

          {/* Lender Stats */}
          <h3>Your Lender Stats</h3>
          {lenderInfo ? (
            <ul>
              <li>Deposited: {lenderInfo.depositedAmount} TFX</li>
              <li>Total Earned: {lenderInfo.totalInterestEarned} TFX</li>
              <li>Pending Interest: {lenderInfo.pendingInterest} TFX</li>
            </ul>
          ) : (
            <p>No lending data yet</p>
          )}

          <button onClick={handleClaimInterest} disabled={loading}>
            Claim Interest
          </button>

          {message && <p>{message}</p>}
        </>
      )}
    </div>
  );
};

export default Lend;
