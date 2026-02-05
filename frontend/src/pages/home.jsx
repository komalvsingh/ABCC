import Navbar from "../components/navbar";
import { useBlockchain } from "../context/BlockchainContext";

const Home = () => {
  const { account } = useBlockchain();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Trust-Based, Collateral-Free Micro Lending
        </h2>

        <p className="text-gray-600 text-lg mb-8">
          TrustForge enables fair lending using on-chain trust scores,
          wallet maturity, and transparent smart contracts — no collateral,
          no identity checks.
        </p>

        {account ? (
          <p className="text-green-600 font-medium">
            Wallet connected. You can now explore lending features.
          </p>
        ) : (
          <p className="text-gray-500">
            Connect your wallet to get started.
          </p>
        )}
      </main>
    </div>
  );
};

export default Home;
