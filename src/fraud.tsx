import { useState, useEffect } from "react"
import {
  ChevronDown,
  AlertTriangle,
  Shield,
  Activity,
  ExternalLink
} from "lucide-react"
import "./style.css"

interface FraudDetectionProps {
  onNavigateToBlockedUsers: () => void
  onNavigateToBlockedProfiles: () => void
  onNavigateToSpamPosts: () => void
  onNavigateToSpamUser: () => void
  onNavigateToActivityLogs: () => void
}

export default function FraudDetection({
  onNavigateToBlockedUsers,
  onNavigateToBlockedProfiles,
  onNavigateToSpamPosts,
  onNavigateToSpamUser,
  onNavigateToActivityLogs
}: FraudDetectionProps) {
  const [status, setStatus] = useState<boolean>(false)
  const [hideFakePosts, setHideFakePosts] = useState<boolean>(false)
  const [hideSuspiciousPosts, setHideSuspiciousPosts] = useState<boolean>(false)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)
  const [_, setEnabled] = useState(true)

  const handleLogoClick = () => {
    const newStatus = !status

    setStatus(newStatus)

    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.set({ status: newStatus }, () => {
        window.chrome.runtime?.sendMessage({
          action: "SETTINGS_UPDATED",
          setting: "status",
          value: newStatus,
        })
      })
    }
  }

  const [toggleCounts, setToggleCounts] = useState<Record<string, number[]>>({
    status: [],
    hideFakePosts: [],
    hideSuspiciousPosts: [],
  })

  useEffect(() => {
    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.get(["status", "hideFakePosts", "hideSuspiciousPosts"], (data: any) => {
        if (data.status !== undefined) setStatus(data.status)
        else {
          setStatus(true)
          window.chrome.storage.local.set({ status: true })
        }
        if (data.hideFakePosts !== undefined) setHideFakePosts(data.hideFakePosts)
        if (data.hideSuspiciousPosts !== undefined) setHideSuspiciousPosts(data.hideSuspiciousPosts)
      })
      window.chrome.storage.local.get(["statusEnabled"], (data) => {
        setEnabled(data.statusEnabled ?? true)
      })
    }
  }, [])

  const isRateLimited = (setting: string): boolean => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    const recentToggles = toggleCounts[setting]?.filter((t) => t > oneMinuteAgo) || []
    return recentToggles.length >= 10
  }

  const handleToggle = (setting: string, value: boolean) => {
    if (isRateLimited(setting)) {
      alert(`You're toggling too frequently. Please wait a moment before toggling again.`)
      return
    }

    const now = Date.now()
    setToggleCounts((prev) => ({
      ...prev,
      [setting]: [...(prev[setting] || []), now],
    }))

    switch (setting) {
      case "status":
        setStatus(value)
        break
      case "hideFakePosts":
        setHideFakePosts(value)
        break
      case "hideSuspiciousPosts":
        setHideSuspiciousPosts(value)
        break
    }

    if (typeof window !== "undefined" && window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({
        action: "SETTINGS_UPDATED",
        setting,
        value,
      })
    }

    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.set({ [setting]: value })
    }
  }

  return (
    <div className="fraud-detection-container">
      <div className={`logo-section ${status ? "logo-active" : "logo-inactive"}`}>
        <div className="logo">
          <img
            src="/main-logo.png"
            alt="Dehix Logo"
            className="logo-icon"
            onClick={handleLogoClick}
          />
        </div>
      </div>

      <div className="content-section">
        <h1 className="title">Dehix Fraud Detector</h1>

        <div className="settings-card">
          <div className="toggle-list">
            <div className="toggle-item">
              <div className="toggle-label">
                <Activity className="toggle-icon status-icon" size={18} />
                <span>Status</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={status}
                  onChange={(e) => handleToggle("status", e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-label">
                <Shield className="toggle-icon shield-icon" size={18} />
                <span>Hide fake posts</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideFakePosts}
                  onChange={(e) => handleToggle("hideFakePosts", e.target.checked)}
                  disabled={!status}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-label">
                <AlertTriangle className="toggle-icon alert-icon" size={18} />
                <span className="toggle-text">Hide suspicious posts</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideSuspiciousPosts}
                  onChange={(e) => handleToggle("hideSuspiciousPosts", e.target.checked)}
                  disabled={!status}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button className="action-button" disabled={!status}>
            <div className="button-content" onClick={onNavigateToActivityLogs}>
              <Activity size={16} className="button-icon" />
              <span>activity</span>
            </div>
          </button>
          <button className="action-button">
            <div className="button-content">
              <ExternalLink size={16} className="button-icon" />
              <span>Dehix</span>
            </div>
          </button>
        </div>

        <div className="custom-accordion">
          <div className="accordion-header" onClick={() => setAdvancedOpen(!advancedOpen)}>
            <div className="accordion-title">
              <span>Advanced Settings</span>
            </div>
            <ChevronDown className={`chevron-icon ${advancedOpen ? "rotate" : ""}`} size={16} />
          </div>
          {advancedOpen && (
            <div className="accordion-content">
              <div className="advanced-options">
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedUsers}>
                  <span>Block Post</span>
                </button>
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedProfiles}>
                  <span>Block User</span>
                </button>
                <button
                  className="advanced-option-button block-button-red"
                  onClick={onNavigateToSpamPosts}
                  disabled={!status}
                >
                  <span>Spam Post</span>
                </button>
                <button
                  className="advanced-option-button block-button-red"
                  onClick={onNavigateToSpamUser}
                  disabled={!status}
                >
                  <span>Spam User</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
