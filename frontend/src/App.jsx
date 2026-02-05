import { BlockchainProvider } from "./context/BlockchainContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/home";

function App() {
  return (
    <BlockchainProvider>
      <Dashboard />
      <Home/>
    </BlockchainProvider>
  );
}
export default App;
