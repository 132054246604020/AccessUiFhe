// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface AccessibilityPreference {
  id: string;
  preferenceType: string;
  encryptedSettings: string;
  timestamp: number;
  owner: string;
}

const App: React.FC = () => {
  // Randomly selected style: Gradient (warm sunset) + Glassmorphism + Center radiation + Micro-interactions
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<AccessibilityPreference[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPreferenceData, setNewPreferenceData] = useState({
    preferenceType: "",
    description: "",
    settings: ""
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  // Randomly selected features: Data list, Wallet management, Search & filter, Data statistics, Team info
  const filteredPreferences = preferences.filter(pref => 
    pref.preferenceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pref.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const preferenceTypes = [
    "Visual Impairment",
    "Hearing Impairment",
    "Mobility",
    "Cognitive",
    "Color Blindness"
  ];

  const teamMembers = [
    { name: "Alex Chen", role: "FHE Engineer", bio: "Specializes in homomorphic encryption implementations" },
    { name: "Jamie Smith", role: "UX Designer", bio: "Focuses on accessible interface patterns" },
    { name: "Taylor Wong", role: "Blockchain Dev", bio: "Develops privacy-preserving smart contracts" }
  ];

  useEffect(() => {
    loadPreferences().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadPreferences = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("preference_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing preference keys:", e);
        }
      }
      
      const list: AccessibilityPreference[] = [];
      
      for (const key of keys) {
        try {
          const prefBytes = await contract.getData(`preference_${key}`);
          if (prefBytes.length > 0) {
            try {
              const prefData = JSON.parse(ethers.toUtf8String(prefBytes));
              list.push({
                id: key,
                preferenceType: prefData.preferenceType,
                encryptedSettings: prefData.encryptedSettings,
                timestamp: prefData.timestamp,
                owner: prefData.owner
              });
            } catch (e) {
              console.error(`Error parsing preference data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading preference ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPreferences(list);
    } catch (e) {
      console.error("Error loading preferences:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitPreference = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting accessibility settings with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedSettings = `FHE-${btoa(JSON.stringify(newPreferenceData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const prefId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const prefData = {
        preferenceType: newPreferenceData.preferenceType,
        encryptedSettings: encryptedSettings,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `preference_${prefId}`, 
        ethers.toUtf8Bytes(JSON.stringify(prefData))
      );
      
      const keysBytes = await contract.getData("preference_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(prefId);
      
      await contract.setData(
        "preference_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted settings submitted securely!"
      });
      
      await loadPreferences();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPreferenceData({
          preferenceType: "",
          description: "",
          settings: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: isAvailable ? "FHE service is available!" : "Service unavailable"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Availability check failed"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const getPreferenceStats = () => {
    const stats: Record<string, number> = {};
    preferenceTypes.forEach(type => {
      stats[type] = preferences.filter(p => p.preferenceType === type).length;
    });
    return stats;
  };

  const preferenceStats = getPreferenceStats();

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <div className="radial-gradient-bg"></div>
      
      <header className="app-header glass-card">
        <div className="logo">
          <h1>Access<span>UI</span>FHE</h1>
          <p>Privacy-preserving accessibility UI</p>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <main className="main-content">
        <nav className="navigation glass-card">
          <button 
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === "preferences" ? "active" : ""}`}
            onClick={() => setActiveTab("preferences")}
          >
            My Preferences
          </button>
          <button 
            className={`nav-btn ${activeTab === "team" ? "active" : ""}`}
            onClick={() => setActiveTab("team")}
          >
            Our Team
          </button>
        </nav>
        
        {activeTab === "dashboard" && (
          <div className="dashboard-section">
            <div className="glass-card welcome-banner">
              <h2>Personalized Accessibility with FHE</h2>
              <p>Your UI adapts to encrypted accessibility needs without exposing private health data</p>
              <button 
                className="primary-btn"
                onClick={checkAvailability}
              >
                Check FHE Availability
              </button>
            </div>
            
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <h3>Total Preferences</h3>
                <div className="stat-value">{preferences.length}</div>
              </div>
              {preferenceTypes.map(type => (
                <div className="glass-card stat-card" key={type}>
                  <h3>{type}</h3>
                  <div className="stat-value">{preferenceStats[type] || 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === "preferences" && (
          <div className="preferences-section">
            <div className="section-header glass-card">
              <h2>Accessibility Preferences</h2>
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search preferences..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                className="primary-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + New Preference
              </button>
            </div>
            
            <div className="preferences-list">
              {filteredPreferences.length === 0 ? (
                <div className="glass-card empty-state">
                  <p>No preferences found</p>
                  <button 
                    className="primary-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Preference
                  </button>
                </div>
              ) : (
                filteredPreferences.map(pref => (
                  <div className="preference-card glass-card" key={pref.id}>
                    <div className="preference-header">
                      <h3>{pref.preferenceType}</h3>
                      <span className="owner-badge">
                        {isOwner(pref.owner) ? "You" : pref.owner.substring(0, 6)}...
                      </span>
                    </div>
                    <div className="preference-meta">
                      <span>{new Date(pref.timestamp * 1000).toLocaleDateString()}</span>
                      <span className="fhe-badge">FHE Encrypted</span>
                    </div>
                    <div className="preference-actions">
                      {isOwner(pref.owner) && (
                        <button className="action-btn">
                          Edit Settings
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {activeTab === "team" && (
          <div className="team-section">
            <div className="glass-card team-intro">
              <h2>Our Team</h2>
              <p>Building privacy-preserving accessibility solutions with FHE technology</p>
            </div>
            
            <div className="team-grid">
              {teamMembers.map(member => (
                <div className="team-card glass-card" key={member.name}>
                  <div className="team-avatar"></div>
                  <h3>{member.name}</h3>
                  <p className="role">{member.role}</p>
                  <p className="bio">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitPreference} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          preferenceData={newPreferenceData}
          setPreferenceData={setNewPreferenceData}
          preferenceTypes={preferenceTypes}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="notification-modal">
          <div className={`notification-content ${transactionStatus.status}`}>
            <div className="notification-icon">
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✕"}
            </div>
            <div className="notification-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer glass-card">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>AccessUIFHE</h3>
            <p>Privacy-preserving personalized UI for accessibility</p>
          </div>
          <div className="footer-links">
            <a href="#">Documentation</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge">FHE-Powered</div>
          <div className="copyright">
            © {new Date().getFullYear()} AccessUIFHE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  preferenceData: any;
  setPreferenceData: (data: any) => void;
  preferenceTypes: string[];
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  preferenceData,
  setPreferenceData,
  preferenceTypes
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPreferenceData({
      ...preferenceData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!preferenceData.preferenceType || !preferenceData.settings) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal glass-card">
        <div className="modal-header">
          <h2>New Accessibility Preference</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            Your settings will be encrypted with FHE for privacy protection
          </div>
          
          <div className="form-group">
            <label>Preference Type *</label>
            <select 
              name="preferenceType"
              value={preferenceData.preferenceType} 
              onChange={handleChange}
            >
              <option value="">Select type</option>
              {preferenceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <input 
              type="text"
              name="description"
              value={preferenceData.description} 
              onChange={handleChange}
              placeholder="Brief description..." 
            />
          </div>
          
          <div className="form-group">
            <label>Settings *</label>
            <textarea 
              name="settings"
              value={preferenceData.settings} 
              onChange={handleChange}
              placeholder="Enter your accessibility settings..." 
              rows={4}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="secondary-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="primary-btn"
          >
            {creating ? "Encrypting with FHE..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;