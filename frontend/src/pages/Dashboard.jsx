import { useBlockchain } from "../context/BlockchainContext";

const Dashboard = () => {
  const {
    account,
    tfx,
    getTFXBalance,
    requestLoan,
    getUserProfile,
  } = useBlockchain();

  const load = async () => {
    const bal = await getTFXBalance();
    const profile = await getUserProfile();
    console.log(bal, profile);
  };

  return (
    <div>
      <h2>{account}</h2>
      <button disabled={!tfx} onClick={load}>
        Load Data
      </button>
      <button onClick={() => requestLoan("0.05")}>
        Borrow 0.05 TFX
      </button>
    </div>
  );
};

export default Dashboard;
    