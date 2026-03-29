
"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatusBadge,
  TextArea,
} from "@/components/ui";

type FilterType = "all" | "pending" | "approved" | "rejected" | "frozen";

type AgentRecord = {
  id: string;
  fullName?: string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  country?: string;
  status?: string;
  frozen?: boolean;
  online?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

function buildAgentApprovalMessage(agent: AgentRecord) {
  return `Hello, your agent account has been approved successfully.

Agent login credentials:
- Username: ${agent.username || (agent.email || "").split("@")[0]}
- Password: (same as your account password)
- Email: ${agent.email || ""}

Please keep these credentials private.
These credentials are valid for GoSport365 MobCash.

------------------------------

مرحبًا، تمت الموافقة على حساب الوكيل الخاص بك بنجاح.

بيانات الدخول:
- Username: ${agent.username || (agent.email || "").split("@")[0]}
- Password: (same as your account password)
- Email: ${agent.email || ""}

يرجى الحفاظ على هذه البيانات بشكل سري.
هذه البيانات صالحة للدخول إلى GoSport365 MobCash.`;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState("");

  const loadAgents = async () => {
    const res = await fetch("/api/admin/agent-applications", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to load agents");
      return;
    }

    setAgents(data.data || []);
  };

  useEffect(() => {
    loadAgents().finally(() => setLoading(false));
  }, []);

  const filteredAgents = useMemo(() => {
    const normalizeStatus = (status?: string) => {
      if (!status) return "pending";
      return status; // pending | approved | rejected
    };

    if (filter === "pending") return agents.filter((agent) => normalizeStatus(agent.status) === "pending");
    if (filter === "approved") return agents.filter((agent) => normalizeStatus(agent.status) === "approved");
    if (filter === "rejected") return agents.filter((agent) => normalizeStatus(agent.status) === "rejected");
    if (filter === "frozen") return agents.filter((agent) => agent.frozen === true);
    return agents;
  }, [agents, filter]);

  const copyMessage = async (messageText: string) => {
    await navigator.clipboard.writeText(messageText);
    setSelectedMessage(messageText);
    alert("Message copied successfully");
  };

  const handleAction = async (agentId: string, action: "approve" | "reject") => {
    try {
      setBusyId(agentId);

      const res = await fetch("/api/admin/agent-applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Action failed");
        return;
      }

      if (data.officialMessage) {
        setSelectedMessage(data.officialMessage);
      }

      await loadAgents();
      alert(data.message || "Updated successfully");
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="Loading agent applications..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Agent applications"
        subtitle="Review pending requests, approve clean applications, reject invalid ones and copy the official agent approval message when needed."
      />

      <div className="flex flex-wrap gap-3">
        {(["all", "pending", "approved", "rejected", "frozen"] as FilterType[]).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              filter === item ? "bg-white text-slate-900" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {filteredAgents.map((agent) => {
            const displayName = agent.fullName || agent.full_name || "Unnamed agent";
            const createdValue = agent.createdAt || agent.created_at;
            const status = agent.status || "pending";
            const officialMessage = buildAgentApprovalMessage(agent);

            return (
              <GlassCard key={agent.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{displayName}</h3>
                    <p className="mt-2 text-sm text-white/55">{agent.email}</p>
                    <p className="mt-2 text-sm text-white/45">Username: {agent.username || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Phone: {agent.phone || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Country: {agent.country || "—"}</p>
                    <p className="mt-2 text-sm text-white/45">Created: {createdValue ? new Date(createdValue).toLocaleString() : "—"}</p>
                    <div className="mt-3"><StatusBadge status={status} /></div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {status === "pending" ? (
                      <>
                        <PrimaryButton onClick={() => handleAction(agent.id, "approve")} disabled={busyId === agent.id}>
                          {busyId === agent.id ? "Processing..." : "Approve"}
                        </PrimaryButton>
                        <button
                          onClick={() => handleAction(agent.id, "reject")}
                          disabled={busyId === agent.id}
                          className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {busyId === agent.id ? "Processing..." : "Reject"}
                        </button>
                      </>
                    ) : null}

                    {status === "approved" ? (
                      <PrimaryButton onClick={() => copyMessage(officialMessage)}>
                        <Copy size={16} className="mr-2 inline-block" />
                        Copy Approval Message
                      </PrimaryButton>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {!filteredAgents.length ? (
            <GlassCard className="p-10 text-center text-white/65">
              No agents found for this filter.
            </GlassCard>
          ) : null}
        </div>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Official message preview</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">Use this when admin approves a new agent account and needs to send the final onboarding credentials.</p>
          <TextArea rows={18} value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} className="mt-5" />
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
