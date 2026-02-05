import { useBlockchain } from "../context/BlockchainContext";
import { useState } from "react";

const Navbar = () => {
  const { account, connectWallet, disconnectWallet } = useBlockchain();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectWallet();
    } catch (error) {
      console.error("Connection failed:", error);
      alert(error.message || "Failed to connect wallet. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const shortAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 bg-white border-b">
      <h1 className="text-xl font-bold text-indigo-600">TrustForge</h1>

      <div>
        {!account ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 font-mono">
              {shortAddress(account)}
            </span>
            <button
              onClick={disconnectWallet}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;