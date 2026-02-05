import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { BlockchainProvider } from "./context/BlockchainContext";

import Home from "./pages/home";
import Dashboard from "./pages/Dashboard";
import Lend from "./pages/Lend";

function App() {
  return (
    <BlockchainProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lend" element={<Lend />} />
        </Routes>
      </Router>
    </BlockchainProvider>
  );
}

export default App;
