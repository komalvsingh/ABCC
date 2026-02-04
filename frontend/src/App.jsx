import { BlockchainProvider } from "./context/BlockchainContext";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BlockchainProvider>
      <Dashboard />
    </BlockchainProvider>
  );
}
export default App;
