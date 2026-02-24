import React, { useState, useEffect, useRef } from "react";
import { 
  Shield, 
  Clock, 
  Users, 
  Upload, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  MoreVertical,
  MessageSquare,
  FileText,
  TrendingUp,
  X,
  LayoutDashboard,
  Megaphone,
  Plus,
  UserPlus,
  Gift,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Policy {
  id: number;
  customer_name: string;
  policy_number: string;
  policy_type: string;
  expiry_date: string;
  phone: string;
  status: string;
}

interface Stats {
  totalPolicies: number;
  expiringSoon: number;
  expiredCount: number;
  recentLogs: any[];
}

const FESTIVE_PRESETS = [
  { id: "diwali", name: "Diwali", message: "Hello {{1}}! 🪔 Wishing you a Happy Diwali! May your life be as secure as your future. Warm wishes from Kadam Motar Driving School." },
  { id: "dashhera", name: "Dashhera", message: "Hello {{1}}! 🏹 Happy Dashhera! May the victory of protection over risk lead you to a secure future. Regards, Kadam Motar Driving School." },
  { id: "independence", name: "Independence Day", message: "Hello {{1}}! 🇮🇳 Happy Independence Day! Wishing you financial freedom and security on this patriotic day. Regards, Kadam Motar Driving School." },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "campaigns">("dashboard");
  const [stats, setStats] = useState<Stats>({ totalPolicies: 0, expiringSoon: 0, expiredCount: 0, recentLogs: [] });
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isManualMsgOpen, setIsManualMsgOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Policy | null>(null);
  const [manualMsg, setManualMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isTriggering, setIsTriggering] = useState(false);
  const [broadcastTemplate, setBroadcastTemplate] = useState(FESTIVE_PRESETS[0].message);
  const [campaignName, setCampaignName] = useState("");
  
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    policy_number: "",
    policy_type: "Health",
    expiry_date: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const healthRes = await fetch("/api/health");
      if (!healthRes.ok) {
        console.error("Server health check failed", healthRes.status);
      } else {
        const healthData = await healthRes.json();
        console.log("Server health:", healthData);
      }

      const [statsRes, policiesRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/policies")
      ]);

      if (!statsRes.ok || !policiesRes.ok) {
        throw new Error(`HTTP error! status: ${statsRes.status} or ${policiesRes.status}`);
      }

      const statsData = await statsRes.json();
      const policiesData = await policiesRes.json();
      
      setStats(statsData);
      setPolicies(policiesData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setIsUploadOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        setIsAddCustomerOpen(false);
        setNewCustomer({ name: "", phone: "", email: "", policy_number: "", policy_type: "Health", expiry_date: "" });
        fetchData();
      }
    } catch (err) {
      console.error("Add customer failed", err);
    }
  };

  const handleBroadcast = async (isTest: boolean) => {
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignName || "Festive Broadcast",
          messageTemplate: broadcastTemplate,
          isTest
        }),
      });
      if (res.ok) {
        alert(isTest ? "Test message sent to admin!" : "Broadcast initiated successfully!");
      }
    } catch (err) {
      console.error("Broadcast failed", err);
    }
  };

  const handleManualSend = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await fetch("/api/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedCustomer.phone,
          name: selectedCustomer.customer_name,
          message: manualMsg
        }),
      });
      if (res.ok) {
        setIsManualMsgOpen(false);
        setManualMsg("");
        alert("Message sent!");
      }
    } catch (err) {
      console.error("Manual send failed", err);
    }
  };

  const triggerReminders = async () => {
    setIsTriggering(true);
    try {
      await fetch("/api/trigger-reminders", { method: "POST" });
      fetchData();
    } catch (err) {
      console.error("Trigger failed", err);
    } finally {
      setIsTriggering(false);
    }
  };

  const filteredPolicies = policies.filter(p => 
    p.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.policy_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-charcoal text-white font-sans selection:bg-blue-neon/30">
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-64 bg-charcoal-light border-r border-white/5 z-40 hidden md:flex flex-col p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-neon rounded-xl flex items-center justify-center shadow-lg shadow-blue-neon/20">
            <Shield className="text-charcoal" size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight hidden md:block">Kadam Motar</span>
        </div>

        <div className="space-y-2 flex-1">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { id: "inventory", icon: FileText, label: "Inventory" },
            { id: "campaigns", icon: Megaphone, label: "Campaigns" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-neon text-charcoal font-bold shadow-lg shadow-blue-neon/10" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} />
              <span className="hidden md:block">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto">
          <button 
            onClick={() => setIsAddCustomerOpen(true)}
            className="w-full bg-gold-neon text-charcoal font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-gold-neon/10 hover:scale-[1.02] transition-transform"
          >
            <Plus size={20} />
            <span className="hidden md:block">Add Customer</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-10 min-h-screen">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter">
              {activeTab === "dashboard" && "Command Center"}
              {activeTab === "inventory" && "Policy Inventory"}
              {activeTab === "campaigns" && "Broadcast Engine"}
            </h1>
            <p className="text-white/40 mt-1">Managing 500+ customers with precision</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="text" 
                placeholder="Quick search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-neon/50 w-64 transition-all"
              />
            </div>
            <button 
              onClick={triggerReminders}
              disabled={isTriggering}
              className="bg-emerald-neon text-charcoal font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Zap size={18} />
              {isTriggering ? "Syncing..." : "Sync Reminders"}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Bento Grid Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass p-8 md:col-span-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Shield size={120} className="text-blue-neon" />
                  </div>
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Total Active Policies</span>
                  <div className="mt-4 flex items-end gap-4">
                    <span className="text-6xl font-black tracking-tighter">{stats.totalPolicies}</span>
                    <div className="mb-2 px-2 py-1 bg-emerald-neon/10 text-emerald-neon text-xs font-bold rounded-lg flex items-center gap-1">
                      <TrendingUp size={12} /> +12%
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <div className="h-1.5 flex-1 bg-blue-neon rounded-full" />
                    <div className="h-1.5 w-12 bg-white/10 rounded-full" />
                  </div>
                </div>

                <div className="glass p-8 flex flex-col justify-between border-amber-neon/20">
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Expiring Soon</span>
                  <div className="mt-4">
                    <span className="text-5xl font-black text-amber-neon">{stats.expiringSoon}</span>
                    <p className="text-white/20 text-xs mt-2 font-medium">Next 30 days</p>
                  </div>
                </div>

                <div className="glass p-8 flex flex-col justify-between border-red-500/20">
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Already Expired</span>
                  <div className="mt-4">
                    <span className="text-5xl font-black text-red-500">{stats.expiredCount}</span>
                    <p className="text-white/20 text-xs mt-2 font-medium">Action required immediately</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Clock className="text-blue-neon" size={20} />
                      Upcoming Renewals
                    </h2>
                    <button onClick={() => setActiveTab("inventory")} className="text-blue-neon text-xs font-bold hover:underline">View All</button>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {policies
                      .filter(p => new Date(p.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                      .map((policy) => (
                      <div key={policy.id} className="glass p-4 flex items-center justify-between group hover:border-blue-neon/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                            new Date(policy.expiry_date) < new Date() ? "bg-red-500/20 text-red-500" : "bg-blue-neon/20 text-blue-neon"
                          )}>
                            {policy.customer_name[0]}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {policy.customer_name}
                              {new Date(policy.expiry_date) < new Date() && (
                                <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded uppercase font-black">Expired</span>
                              )}
                            </div>
                            <div className="text-xs text-white/30">{policy.policy_type} • {policy.policy_number}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-white/30 uppercase font-bold tracking-tighter">Expires</div>
                            <div className="text-sm font-mono">{policy.expiry_date}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              title="Send WhatsApp"
                              onClick={() => {
                                const msg = `Hello ${policy.customer_name}, your ${policy.policy_type} policy (${policy.policy_number}) is ${new Date(policy.expiry_date) < new Date() ? 'expired' : 'expiring soon'} on ${policy.expiry_date}. Please renew soon.`;
                                const cleanPhone = policy.phone.replace(/\D/g, "");
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                              }}
                              className="p-2.5 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all"
                            >
                              <MessageSquare size={18} />
                            </button>
                            <button 
                              title="Custom Message"
                              onClick={() => {
                                setSelectedCustomer(policy);
                                setIsManualMsgOpen(true);
                                setManualMsg(`Hello ${policy.customer_name}, regarding your ${policy.policy_type} policy...`);
                              }}
                              className="p-2.5 bg-blue-neon/10 text-blue-neon rounded-xl hover:bg-blue-neon hover:text-charcoal transition-all"
                            >
                              <Zap size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Zap className="text-emerald-neon" size={20} />
                    Delivery Status
                  </h2>
                  <div className="glass p-6 space-y-6">
                    {stats.recentLogs.length === 0 ? (
                      <div className="text-center py-10 text-white/20">No recent activity</div>
                    ) : (
                      stats.recentLogs.map((log) => (
                        <div key={log.id} className="flex gap-4">
                          <div className={cn(
                            "mt-1 p-2 rounded-lg shrink-0",
                            log.status === "sent" || log.status === "mock_sent" ? "bg-emerald-neon/10 text-emerald-neon" : "bg-red-500/10 text-red-500"
                          )}>
                            <CheckCircle2 size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{log.customer_name}</div>
                            <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
                              {log.days_remaining} Days Reminder • {log.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "inventory" && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsUploadOpen(true)}
                    className="glass px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-white/10"
                  >
                    <Upload size={16} /> Bulk Import
                  </button>
                </div>
              </div>

              <div className="glass overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-white/30 text-[10px] uppercase font-black tracking-widest">
                      <th className="px-8 py-5">Customer Details</th>
                      <th className="px-8 py-5">Policy Info</th>
                      <th className="px-8 py-5">Expiry Date</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPolicies.map((policy) => (
                      <tr key={policy.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-5">
                          <div className="font-bold text-sm">{policy.customer_name}</div>
                          <div className="text-xs text-white/30 font-mono mt-0.5">{policy.phone}</div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="text-xs font-bold text-blue-neon">{policy.policy_type}</div>
                          <div className="text-[10px] text-white/30 mt-0.5">{policy.policy_number}</div>
                        </td>
                        <td className="px-8 py-5 font-mono text-sm">{policy.expiry_date}</td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "text-[10px] font-black uppercase px-2 py-1 rounded-md",
                            new Date(policy.expiry_date) < new Date() ? "bg-red-500/10 text-red-500" : "bg-emerald-neon/10 text-emerald-neon"
                          )}>
                            {new Date(policy.expiry_date) < new Date() ? "Expired" : "Active"}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              title="Send WhatsApp"
                              onClick={() => {
                                const msg = `Hello ${policy.customer_name}, your ${policy.policy_type} policy (${policy.policy_number}) is ${new Date(policy.expiry_date) < new Date() ? 'expired' : 'expiring soon'} on ${policy.expiry_date}. Please renew soon.`;
                                const cleanPhone = policy.phone.replace(/\D/g, "");
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                              }}
                              className="p-2 hover:bg-[#25D366]/10 text-[#25D366] rounded-lg"
                            >
                              <MessageSquare size={16} />
                            </button>
                            <button 
                              title="Custom Message"
                              onClick={() => {
                                setSelectedCustomer(policy);
                                setIsManualMsgOpen(true);
                                setManualMsg(`Hello ${policy.customer_name}, regarding your ${policy.policy_type} policy...`);
                              }}
                              className="p-2 hover:bg-blue-neon/10 text-blue-neon rounded-lg"
                            >
                              <Zap size={16} />
                            </button>
                            <button className="p-2 hover:bg-white/10 text-white/30 rounded-lg">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "campaigns" && (
            <motion.div 
              key="campaigns"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="space-y-8">
                <div className="glass p-8 space-y-6">
                  <h2 className="text-2xl font-black tracking-tight">Global Broadcast Engine</h2>
                  
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Campaign Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Diwali Greeting 2026"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-neon/50"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Festive Presets</label>
                      <Gift className="text-gold-neon" size={16} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {FESTIVE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setBroadcastTemplate(preset.message)}
                          className={cn(
                            "py-2 text-[10px] font-black uppercase rounded-lg border transition-all",
                            broadcastTemplate === preset.message 
                              ? "bg-gold-neon border-gold-neon text-charcoal" 
                              : "border-white/10 text-white/40 hover:border-white/30"
                          )}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Message Content</label>
                    <textarea 
                      rows={6}
                      value={broadcastTemplate}
                      onChange={(e) => setBroadcastTemplate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-neon/50 text-sm leading-relaxed"
                    />
                    <p className="text-[10px] text-white/20 italic">Use {"{{1}}"} for customer name placeholder.</p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => handleBroadcast(true)}
                      className="flex-1 glass py-3 font-bold text-sm hover:bg-white/10 transition-colors"
                    >
                      Test Send to Self
                    </button>
                    <button 
                      onClick={() => handleBroadcast(false)}
                      className="flex-[2] bg-blue-neon text-charcoal font-black py-3 rounded-xl shadow-lg shadow-blue-neon/20 hover:scale-[1.02] transition-transform"
                    >
                      Blast to 500+ Customers
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="glass p-8 bg-blue-neon/5 border-blue-neon/20">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-blue-neon">
                    <Zap size={20} />
                    Broadcast Safety
                  </h3>
                  <ul className="mt-4 space-y-4">
                    {[
                      "Rate limiting active: 10 messages per minute",
                      "Personalized tags automatically replaced",
                      "Test send recommended before global blast",
                      "Ensure WhatsApp templates are pre-approved"
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                        <CheckCircle2 className="text-blue-neon mt-0.5 shrink-0" size={16} />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass p-8">
                  <h3 className="text-lg font-bold mb-6">Recent Campaigns</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                      <div>
                        <div className="font-bold text-sm">Independence Day 2025</div>
                        <div className="text-[10px] text-white/30 uppercase font-bold mt-1">Sent to 482 recipients</div>
                      </div>
                      <span className="text-[10px] font-black text-emerald-neon uppercase">Completed</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddCustomerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddCustomerOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass max-w-lg w-full p-10 relative z-10 bg-charcoal-light shadow-2xl">
              <h3 className="text-2xl font-black mb-6">Add New Customer</h3>
              <form onSubmit={handleAddCustomer} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Full Name</label>
                    <input required type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Phone Number</label>
                    <input required type="text" placeholder="+91..." value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Email Address</label>
                  <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Policy Number</label>
                    <input required type="text" value={newCustomer.policy_number} onChange={e => setNewCustomer({...newCustomer, policy_number: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Policy Type</label>
                    <select value={newCustomer.policy_type} onChange={e => setNewCustomer({...newCustomer, policy_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none">
                      {["Health", "Motor", "Life", "Home", "Travel"].map(t => <option key={t} value={t} className="bg-charcoal">{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Expiry Date</label>
                  <input required type="date" value={newCustomer.expiry_date} onChange={e => setNewCustomer({...newCustomer, expiry_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none" />
                </div>
                <button type="submit" className="w-full bg-blue-neon text-charcoal font-black py-4 rounded-xl shadow-xl shadow-blue-neon/20 hover:scale-[1.02] transition-transform">
                  Register Policy
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isManualMsgOpen && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsManualMsgOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass max-w-md w-full p-8 relative z-10 bg-charcoal-light">
              <h3 className="text-xl font-bold mb-2">Message {selectedCustomer.customer_name}</h3>
              <p className="text-xs text-white/40 mb-6">Direct WhatsApp communication</p>
              <textarea 
                rows={5}
                value={manualMsg}
                onChange={e => setManualMsg(e.target.value)}
                placeholder="Type your message here..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-neon/50 outline-none"
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsManualMsgOpen(false)} className="flex-1 py-3 text-sm font-bold text-white/40 hover:text-white">Cancel</button>
                <button onClick={handleManualSend} className="flex-[2] bg-emerald-neon text-charcoal font-black py-3 rounded-xl flex items-center justify-center gap-2">
                  <Send size={18} /> Send Now
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsUploadOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass max-w-md w-full p-8 relative z-10 bg-charcoal-light">
              <div className="text-center mb-8">
                <Upload className="mx-auto text-blue-neon mb-4" size={48} />
                <h3 className="text-xl font-bold">Bulk Import</h3>
                <p className="text-xs text-white/40 mt-2">Upload CSV to sync 500+ records</p>
              </div>
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-neon/50 transition-all">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                <FileText className="mx-auto text-white/10 mb-2" size={32} />
                <span className="text-sm font-bold">Select CSV File</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Nav */}
      <div className="fixed bottom-0 left-0 w-full bg-charcoal-light border-t border-white/5 md:hidden flex justify-around p-4 z-40">
        {[
          { id: "dashboard", icon: LayoutDashboard },
          { id: "inventory", icon: FileText },
          { id: "campaigns", icon: Megaphone },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={cn("p-2 rounded-lg", activeTab === item.id ? "text-blue-neon" : "text-white/30")}>
            <item.icon size={24} />
          </button>
        ))}
        <button onClick={() => setIsAddCustomerOpen(true)} className="p-2 bg-gold-neon text-charcoal rounded-lg">
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
}
